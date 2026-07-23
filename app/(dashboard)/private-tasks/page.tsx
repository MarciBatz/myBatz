'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import PriorityBadge from '@/components/PriorityBadge'
import { formatDate, formatDateTime } from '@/lib/utils'
import {
  PRIVATE_TASK_COLUMNS,
  COLUMN_LABELS,
  COLUMN_COLORS,
  type PrivateTaskColumnValue,
  canUsePrivateTasks,
  type PrivateTask,
  type LinkableTicket,
} from '@/lib/private-tasks'
import PrivateTaskModal from '@/components/PrivateTaskModal'

type Scope = { kind: 'all' } | { kind: 'unlinked' } | { kind: 'ticket'; id: string } | { kind: 'archive' }

interface ArchiveEvent { id: string; type: string; fromColumn: string | null; toColumn: string | null; createdAt: string }
interface ArchiveComment { id: string; body: string; createdAt: string }
interface ArchiveTask {
  id: string; title: string; description: string | null; priority: string
  doneAt: string | null; archivedAt: string | null; createdAt: string
  ticket: { id: string; title: string } | null
  events: ArchiveEvent[]
  comments: ArchiveComment[]
}

export default function PrivateTasksPage() {
  const router = useRouter()
  const [allowed, setAllowed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tasks, setTasks] = useState<PrivateTask[]>([])
  const [linkable, setLinkable] = useState<LinkableTicket[]>([])
  const [scope, setScope] = useState<Scope>({ kind: 'all' })
  const [editing, setEditing] = useState<PrivateTask | null>(null)
  const [creatingIn, setCreatingIn] = useState<PrivateTaskColumnValue | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<PrivateTaskColumnValue | null>(null)
  const [error, setError] = useState('')
  const dragIdRef = useRef<string | null>(null)
  // Feature: moving a linked task to Kész offers to close the public ticket.
  const [closePrompt, setClosePrompt] = useState<{ ticketId: string; ticketTitle: string } | null>(null)
  const [closeReminder, setCloseReminder] = useState<{ ticketId: string; ticketTitle: string } | null>(null)
  const [closingTicket, setClosingTicket] = useState(false)
  const [addingTicketId, setAddingTicketId] = useState<string | null>(null)
  const [confirmAddTicketId, setConfirmAddTicketId] = useState<string | null>(null)
  const [archiveTasks, setArchiveTasks] = useState<ArchiveTask[]>([])
  const [archiveLoading, setArchiveLoading] = useState(false)
  const [expandedArchive, setExpandedArchive] = useState<string | null>(null)
  const [archivingId, setArchivingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null)

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (canUsePrivateTasks(d.user?.role)) {
        setAllowed(true)
        load()
        loadArchive() // for an accurate count on the rail
      } else {
        router.replace('/dashboard')
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const load = useCallback(async () => {
    const res = await fetch('/api/private-tasks')
    const d = await res.json()
    setTasks(d.tasks || [])
    setLinkable(d.linkableTickets || [])
    setLoading(false)
  }, [])

  function inScope(t: PrivateTask) {
    if (scope.kind === 'ticket') return t.ticketId === scope.id
    if (scope.kind === 'unlinked') return !t.ticketId
    return true // 'all' (and 'archive', which doesn't render the board)
  }

  const visible = tasks.filter(inScope)
  function columnTasks(col: PrivateTaskColumnValue) {
    return visible
      .filter(t => t.column === col)
      .sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt))
  }

  async function handleDrop(col: PrivateTaskColumnValue) {
    const id = dragIdRef.current
    setDragId(null)
    setDragOverCol(null)
    dragIdRef.current = null
    if (!id) return
    const task = tasks.find(t => t.id === id)
    if (!task || task.column === col) return

    // Optimistic: move the card, then persist the destination column's order.
    const previous = tasks
    const moved = { ...task, column: col }
    const next = tasks.map(t => (t.id === id ? moved : t))
    setTasks(next)

    const ids = next
      .filter(t => t.column === col && inScope(t))
      .sort((a, b) => (a.id === id ? -1 : b.id === id ? 1 : a.position - b.position))
      .map(t => t.id)

    const res = await fetch('/api/private-tasks/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ column: col, ids }),
    })
    if (!res.ok) {
      setTasks(previous)
      setError('Nem sikerült áthelyezni a feladatot')
      return
    }

    // Keep the linked public ticket in step with the board.
    const linkedTicket = task.ticket
    if (linkedTicket) {
      if (col === 'IN_PROGRESS' && (linkedTicket.status === 'OPEN' || linkedTicket.status === 'AWAITING')) {
        // Only promote forward — never reopen a closed ticket, never auto-revert.
        await promoteTicket(linkedTicket.id, 'IN_PROGRESS')
      } else if (col === 'DONE' && linkedTicket.status !== 'CLOSED') {
        // Closing is a deliberate choice, so ask rather than act.
        setClosePrompt({ ticketId: linkedTicket.id, ticketTitle: linkedTicket.title })
      }
    }
    load()
  }

  async function promoteTicket(ticketId: string, status: string) {
    const res = await fetch(`/api/tickets/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) setError('A privát feladat átkerült, de a publikus feladat státuszát nem sikerült frissíteni.')
    return res.ok
  }

  async function confirmCloseTicket() {
    if (!closePrompt) return
    setClosingTicket(true)
    const ok = await promoteTicket(closePrompt.ticketId, 'CLOSED')
    setClosingTicket(false)
    if (ok) {
      setCloseReminder({ ...closePrompt })
      load()
    }
    setClosePrompt(null)
  }

  function onRailAddClick(ticketId: string) {
    // Already have a task for this ticket → confirm before duplicating.
    if (tasks.some(t => t.ticketId === ticketId)) { setConfirmAddTicketId(ticketId); return }
    addTicketToPrivate(ticketId)
  }

  async function addTicketToPrivate(ticketId: string) {
    setConfirmAddTicketId(null)
    setAddingTicketId(ticketId)
    const res = await fetch('/api/private-tasks/from-ticket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticketId }),
    })
    setAddingTicketId(null)
    if (res.ok) {
      load()
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Nem sikerült felvenni a feladatot')
    }
  }

  const loadArchive = useCallback(async () => {
    setArchiveLoading(true)
    const res = await fetch('/api/private-tasks/archive')
    const d = await res.json()
    setArchiveTasks(d.tasks || [])
    setArchiveLoading(false)
  }, [])

  useEffect(() => {
    if (scope.kind === 'archive') loadArchive()
  }, [scope, loadArchive])

  async function archiveTask(id: string) {
    setArchivingId(id)
    const res = await fetch(`/api/private-tasks/${id}/archive`, { method: 'POST' })
    setArchivingId(null)
    if (res.ok) load()
    else setError('Nem sikerült archiválni a feladatot')
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    const id = deleteTarget.id
    setDeleteTarget(null)
    const previous = tasks
    setTasks(tasks.filter(t => t.id !== id))
    const res = await fetch(`/api/private-tasks/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      setTasks(previous)
      setError('Nem sikerült törölni a feladatot')
    }
  }

  if (!allowed) return null

  const unlinkedCount = tasks.filter(t => !t.ticketId).length

  return (
    <div className="min-h-screen">
      <div className="px-4 sm:px-6 pt-6 pb-3">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#6C5CE7' }}>
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Privát feladataim</h1>
            <p className="text-gray-500 text-xs sm:text-sm">
              A feladataid tartalmát rajtad kívül senki nem látja.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-4 sm:mx-6 mb-3 px-3 py-2 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600 flex items-center justify-between">
          {error}
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* Stacks on small screens: a fixed-width rail beside the board leaves the
          board almost no room on a phone. */}
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-5 px-4 sm:px-6 pb-8 lg:items-start">
        {/* Scope filter — a scrollable chip row on mobile, a vertical rail from lg up */}
        <aside className="w-full lg:w-56 shrink-0 bg-white rounded-xl border border-gray-100 p-2">
          <p className="hidden lg:block text-[11px] uppercase tracking-wide text-gray-400 font-semibold px-2 py-1.5">Nézet</p>
          <div className="flex lg:block gap-2 lg:gap-0 overflow-x-auto lg:overflow-visible">
            <RailButton active={scope.kind === 'all'} onClick={() => setScope({ kind: 'all' })}
              label="Összes feladatom" count={tasks.length} />
            <RailButton active={scope.kind === 'unlinked'} onClick={() => setScope({ kind: 'unlinked' })}
              label="Nincs kapcsolva" count={unlinkedCount} muted />

            <p className="hidden lg:block text-[11px] uppercase tracking-wide text-gray-400 font-semibold px-2 py-1.5 mt-2">
              Publikus feladataim
            </p>
            {linkable.map(t => {
              const active = scope.kind === 'ticket' && scope.id === t.id
              const count = tasks.filter(x => x.ticketId === t.id).length
              return (
                <div key={t.id} className="flex items-center gap-1 shrink-0 lg:w-full">
                  <button
                    onClick={() => setScope({ kind: 'ticket', id: t.id })}
                    className={`min-w-0 lg:flex-1 flex items-center gap-2 px-2.5 lg:px-2 py-1.5 rounded-lg text-left border lg:border-0 ${
                      active ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'text-gray-600 hover:bg-gray-50 border-gray-100'
                    }`}
                  >
                    <span className="text-sm truncate max-w-36 lg:max-w-none lg:flex-1">{t.title}</span>
                    <span className="text-[11px] text-gray-400 shrink-0">{count}</span>
                  </button>
                  <button
                    onClick={() => onRailAddClick(t.id)}
                    disabled={addingTicketId === t.id}
                    title="Felveszem a privát feladataim közé (Teendők)"
                    className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-50"
                  >
                    {addingTicketId === t.id ? (
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    )}
                  </button>
                </div>
              )
            })}
            {linkable.length === 0 && (
              <p className="hidden lg:block px-2 py-1.5 text-xs text-gray-400">Jelenleg nincs rád osztott nyitott feladat.</p>
            )}

            {/* Archive view */}
            <div className="hidden lg:block border-t border-gray-100 mt-2 pt-2" />
            <RailButton active={scope.kind === 'archive'} onClick={() => setScope({ kind: 'archive' })}
              label="🗄 Archívum" count={archiveTasks.length || 0} muted />
          </div>
        </aside>

        {/* Board */}
        {scope.kind !== 'archive' && (
        <div className="flex-1 min-w-0 overflow-x-auto">
          <div className="flex gap-4 min-w-max pb-2">
            {PRIVATE_TASK_COLUMNS.map(col => {
              const list = columnTasks(col)
              return (
                <section
                  key={col}
                  onDragOver={e => { e.preventDefault(); setDragOverCol(col) }}
                  onDragLeave={() => setDragOverCol(c => (c === col ? null : c))}
                  onDrop={() => handleDrop(col)}
                  className={`w-[82vw] max-w-72 sm:w-72 shrink-0 rounded-xl border transition-colors ${
                    dragOverCol === col ? 'border-indigo-300 bg-indigo-50/40' : 'border-gray-100 bg-gray-50/60'
                  }`}
                >
                  <header className="flex items-center justify-between px-3 py-2.5 rounded-t-xl text-white"
                    style={{ background: COLUMN_COLORS[col] }}>
                    <span className="text-sm font-semibold">{COLUMN_LABELS[col]}</span>
                    <span className="text-xs bg-white/25 rounded-full px-2 py-0.5">{list.length}</span>
                  </header>

                  <div className="p-2 space-y-2 min-h-24">
                    {list.map(t => (
                      <article
                        key={t.id}
                        draggable
                        onDragStart={() => { dragIdRef.current = t.id; setDragId(t.id) }}
                        onDragEnd={() => { dragIdRef.current = null; setDragId(null); setDragOverCol(null) }}
                        onClick={() => setEditing(t)}
                        className={`bg-white rounded-lg border border-gray-100 p-2.5 cursor-pointer hover:border-indigo-200 hover:shadow-sm transition-all ${
                          dragId === t.id ? 'opacity-40' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm text-gray-800 font-medium leading-snug">{t.title}</p>
                          <div className="flex items-center gap-0.5 shrink-0">
                            {col === 'DONE' && (
                              <button
                                onClick={e => { e.stopPropagation(); archiveTask(t.id) }}
                                disabled={archivingId === t.id}
                                title="Archiválás"
                                className="text-gray-300 hover:text-indigo-500 p-0.5 disabled:opacity-50"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8M10 12h4" /></svg>
                              </button>
                            )}
                            <button
                              onClick={e => { e.stopPropagation(); setDeleteTarget({ id: t.id, title: t.title }) }}
                              title="Törlés"
                              className="text-gray-300 hover:text-red-400 p-0.5"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap mt-2">
                          <PriorityBadge priority={t.priority} />
                          {t.dueDate && (
                            <span className="text-[11px] text-gray-500 bg-gray-100 rounded px-1.5 py-0.5">
                              {formatDate(t.dueDate)}
                            </span>
                          )}
                          {!!t._count?.comments && (
                            <span className="text-[11px] text-gray-500 flex items-center gap-0.5" title={`${t._count.comments} haladás bejegyzés`}>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4-.8L3 20l1.3-3.9A7.96 7.96 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                              {t._count.comments}
                            </span>
                          )}
                        </div>

                        {t.ticket && (
                          <p className="mt-2 pt-2 border-t border-gray-50 text-[11px] text-indigo-500 truncate flex items-center gap-1">
                            <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 01-5.656-5.656l1.5-1.5M10.172 13.828a4 4 0 010-5.656l3-3a4 4 0 015.656 5.656l-1.5 1.5" /></svg>
                            {t.ticket.title}
                          </p>
                        )}
                      </article>
                    ))}

                    <button
                      onClick={() => setCreatingIn(col)}
                      className="w-full text-left text-xs text-gray-400 hover:text-indigo-600 hover:bg-white rounded-lg px-2.5 py-2 transition-colors"
                    >
                      + Új feladat
                    </button>
                  </div>
                </section>
              )
            })}
          </div>

          {!loading && tasks.length === 0 && (
            <p className="text-sm text-gray-400 mt-6">
              Még nincs privát feladatod. Hozz létre egyet bármelyik oszlopban.
            </p>
          )}
        </div>
        )}

        {/* Archive */}
        {scope.kind === 'archive' && (
          <div className="flex-1 min-w-0">
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700">Archívum</h2>
                <span className="text-xs text-gray-400">{archiveTasks.length} megoldott feladat</span>
              </div>
              {archiveLoading ? (
                <p className="px-4 py-8 text-sm text-gray-400 text-center">Betöltés…</p>
              ) : archiveTasks.length === 0 ? (
                <p className="px-4 py-8 text-sm text-gray-400 text-center">Még nincs archivált feladat. A Kész oszlopban lévő feladatokat archiválhatod.</p>
              ) : (
                <ul className="divide-y divide-gray-50">
                  {archiveTasks.map(t => (
                    <li key={t.id}>
                      <button
                        onClick={() => setExpandedArchive(expandedArchive === t.id ? null : t.id)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                      >
                        <svg className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${expandedArchive === t.id ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-medium text-gray-800 truncate">{t.title}</span>
                          {t.ticket && <span className="block text-[11px] text-indigo-500 truncate">🔗 {t.ticket.title}</span>}
                        </span>
                        <span className="text-[11px] text-gray-400 shrink-0 text-right">
                          Kész: {t.doneAt ? formatDate(t.doneAt) : (t.archivedAt ? formatDate(t.archivedAt) : '—')}
                        </span>
                      </button>
                      {expandedArchive === t.id && (
                        <ArchiveDetail task={t} />
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      {(editing || creatingIn) && (
        <PrivateTaskModal
          task={editing}
          defaultColumn={creatingIn ?? 'TODO'}
          defaultTicketId={scope.kind === 'ticket' ? scope.id : null}
          linkableTickets={linkable}
          onClose={() => { setEditing(null); setCreatingIn(null) }}
          onSaved={() => { setEditing(null); setCreatingIn(null); load() }}
        />
      )}

      {/* Kész → offer to close the linked public ticket */}
      {closePrompt && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setClosePrompt(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="p-5">
              <h3 className="font-semibold text-gray-900 mb-2">Lezárod a publikus feladatot is?</h3>
              <p className="text-sm text-gray-600">
                A kapcsolódó publikus feladat (<span className="font-medium">{closePrompt.ticketTitle}</span>) még nincs lezárva.
                Szeretnéd most lezárni?
              </p>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setClosePrompt(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Kihagyás</button>
              <button onClick={confirmCloseTicket} disabled={closingTicket}
                className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-60"
                style={{ background: '#16A34A' }}>
                {closingTicket ? 'Lezárás...' : 'Igen, lezárom'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* After closing — nudge to leave a comment for colleagues */}
      {closeReminder && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setCloseReminder(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="p-5">
              <h3 className="font-semibold text-gray-900 mb-2">A publikus feladat lezárva</h3>
              <p className="text-sm text-gray-600">
                Amennyiben szükséges, írj megjegyzést a feladathoz, hogy a kollégáid tájékoztatva legyenek a megoldásról.
              </p>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setCloseReminder(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Rendben</button>
              <Link href={`/tickets/${closeReminder.ticketId}`}
                onClick={() => setCloseReminder(null)}
                className="px-4 py-2 text-sm font-medium text-white rounded-lg"
                style={{ background: '#6C5CE7' }}>
                Feladat megnyitása
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="p-5">
              <h3 className="font-semibold text-gray-900 mb-2">Feladat törlése</h3>
              <p className="text-sm text-gray-600">
                Biztosan törlöd a(z) <span className="font-medium text-gray-800">„{deleteTarget.title}”</span> feladatot? Ez nem vonható vissza.
              </p>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Mégse</button>
              <button onClick={confirmDelete}
                className="px-4 py-2 text-sm font-medium text-white rounded-lg bg-red-500 hover:bg-red-600">Törlés</button>
            </div>
          </div>
        </div>
      )}

      {/* Rail "+" re-add confirm */}
      {confirmAddTicketId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setConfirmAddTicketId(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="p-5">
              <h3 className="font-semibold text-gray-900 mb-2">Már rögzítve van</h3>
              <p className="text-sm text-gray-600">
                Ehhez a publikus feladathoz már tartozik privát feladatod. Biztosan szeretnéd ismét rögzíteni?
              </p>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setConfirmAddTicketId(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Nem</button>
              <button onClick={() => addTicketToPrivate(confirmAddTicketId)}
                className="px-4 py-2 text-sm font-medium text-white rounded-lg"
                style={{ background: '#6C5CE7' }}>Igen, rögzítem</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function RailButton({ active, onClick, label, count, muted }: {
  active: boolean; onClick: () => void; label: string; count: number; muted?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 lg:shrink lg:w-full flex items-center gap-2 px-2.5 lg:px-2 py-1.5 rounded-lg text-left transition-colors border lg:border-0 ${
        active
          ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
          : 'text-gray-600 hover:bg-gray-50 border-gray-100'
      }`}
    >
      <span className={`text-sm whitespace-nowrap lg:truncate lg:flex-1 max-w-40 lg:max-w-none truncate ${muted && !active ? 'text-gray-400' : ''}`}>
        {label}
      </span>
      <span className="text-[11px] text-gray-400 shrink-0">{count}</span>
    </button>
  )
}

// Merged lifecycle timeline (events + progress notes) for one archived task.
function ArchiveDetail({ task }: { task: ArchiveTask }) {
  const colLabel = (c: string | null) => (c && COLUMN_LABELS[c as PrivateTaskColumnValue]) || c || '—'

  type Row = { at: string; node: React.ReactNode; dot: string }
  const rows: Row[] = []

  for (const e of task.events) {
    if (e.type === 'created') {
      rows.push({ at: e.createdAt, dot: '#64748B', node: <>Létrehozva a(z) <strong>{colLabel(e.toColumn)}</strong> oszlopban</> })
    } else if (e.type === 'moved') {
      rows.push({ at: e.createdAt, dot: COLUMN_COLORS[(e.toColumn as PrivateTaskColumnValue)] || '#6C5CE7', node: <>Áthelyezve: <strong>{colLabel(e.fromColumn)}</strong> → <strong>{colLabel(e.toColumn)}</strong></> })
    } else if (e.type === 'archived') {
      rows.push({ at: e.createdAt, dot: '#334155', node: <>Archiválva</> })
    }
  }
  for (const c of task.comments) {
    rows.push({ at: c.createdAt, dot: '#6C5CE7', node: <span className="whitespace-pre-wrap">💬 {c.body}</span> })
  }
  rows.sort((a, b) => a.at.localeCompare(b.at))

  return (
    <div className="px-4 pb-4 pt-1 bg-gray-50/60 border-t border-gray-100">
      {task.description && (
        <p className="text-sm text-gray-600 whitespace-pre-wrap mb-3 mt-3">{task.description}</p>
      )}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <span className="inline-flex items-center gap-1.5 bg-white border border-gray-100 rounded-lg px-2.5 py-1 text-[11px] text-gray-600">
          <PriorityBadge priority={task.priority} />
        </span>
        {task.ticket && (
          <Link href={`/tickets/${task.ticket.id}`} className="inline-flex items-center gap-1 bg-white border border-gray-100 rounded-lg px-2.5 py-1 text-[11px] text-indigo-600 hover:border-indigo-200">
            🔗 {task.ticket.title}
          </Link>
        )}
      </div>

      <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-2">Történet</p>
      {rows.length === 0 ? (
        <p className="text-xs text-gray-400">Ehhez a feladathoz nincs rögzített esemény.</p>
      ) : (
        <ol className="space-y-2">
          {rows.map((r, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: r.dot }} />
              <div className="min-w-0">
                <p className="text-sm text-gray-700 leading-snug">{r.node}</p>
                <p className="text-[11px] text-gray-400">{formatDateTime(r.at)}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import PriorityBadge from '@/components/PriorityBadge'
import { formatDate } from '@/lib/utils'
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

type Scope = { kind: 'all' } | { kind: 'unlinked' } | { kind: 'ticket'; id: string }

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

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (canUsePrivateTasks(d.user?.role)) {
        setAllowed(true)
        load()
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
    if (scope.kind === 'all') return true
    if (scope.kind === 'unlinked') return !t.ticketId
    return t.ticketId === scope.id
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
    load()
  }

  async function handleDelete(id: string) {
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
              A feladataid tartalmát rajtad kívül senki nem látja. A Napló csak annyit rögzít, hogy történt itt valami.
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
            {linkable.map(t => (
              <RailButton key={t.id}
                active={scope.kind === 'ticket' && scope.id === t.id}
                onClick={() => setScope({ kind: 'ticket', id: t.id })}
                label={t.title}
                count={tasks.filter(x => x.ticketId === t.id).length}
              />
            ))}
          </div>
          {linkable.length === 0 && (
            <p className="hidden lg:block px-2 py-1.5 text-xs text-gray-400">Jelenleg nincs rád osztott nyitott feladat.</p>
          )}
        </aside>

        {/* Board */}
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
                          <button
                            onClick={e => { e.stopPropagation(); handleDelete(t.id) }}
                            title="Törlés"
                            className="text-gray-300 hover:text-red-400 p-0.5 shrink-0"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
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

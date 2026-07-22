'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  PRIVATE_TASK_COLUMNS,
  COLUMN_LABELS,
  COLUMN_COLORS,
  type PrivateTaskColumnValue,
} from '@/lib/private-tasks'
import type { PrivateTask, LinkableTicket, PrivateTaskComment } from '@/lib/private-tasks'
import { formatDateTime, formatDate } from '@/lib/utils'

const PRIORITIES = [
  { value: 'LOW', label: 'Alacsony' },
  { value: 'MEDIUM', label: 'Közepes' },
  { value: 'HIGH', label: 'Magas' },
  { value: 'CRITICAL', label: 'Kritikus' },
]

const PRIORITY_LABELS: Record<string, string> = Object.fromEntries(
  PRIORITIES.map(p => [p.value, p.label])
)

export default function PrivateTaskModal({
  task, defaultColumn, defaultTicketId, linkableTickets, onClose, onSaved,
}: {
  task: PrivateTask | null
  defaultColumn: PrivateTaskColumnValue
  defaultTicketId: string | null
  linkableTickets: LinkableTicket[]
  onClose: () => void
  onSaved: () => void
}) {
  // Opening an existing card lands on the read-only view; the pencil switches
  // to the form. Creating a new task starts in the form directly.
  const [mode, setMode] = useState<'view' | 'edit'>(task ? 'view' : 'edit')

  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [column, setColumn] = useState<PrivateTaskColumnValue>(task?.column ?? defaultColumn)
  const [priority, setPriority] = useState(task?.priority ?? 'MEDIUM')
  const [dueDate, setDueDate] = useState(task?.dueDate ? task.dueDate.slice(0, 10) : '')
  const [ticketId, setTicketId] = useState(task?.ticketId ?? defaultTicketId ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [comments, setComments] = useState<PrivateTaskComment[]>([])
  const [newComment, setNewComment] = useState('')
  const [postingComment, setPostingComment] = useState(false)
  const [editingComment, setEditingComment] = useState<{ id: string; body: string } | null>(null)
  // Set once a note is written, so closing the modal refreshes the board even
  // if none of the fields above were touched.
  const [commentsChanged, setCommentsChanged] = useState(false)

  const loadComments = useCallback(async () => {
    if (!task) return
    const res = await fetch(`/api/private-tasks/${task.id}/comments`)
    if (!res.ok) return
    const d = await res.json()
    setComments(d.comments || [])
  }, [task])

  useEffect(() => { loadComments() }, [loadComments])

  async function addComment() {
    if (!task || !newComment.trim()) return
    setPostingComment(true)
    const res = await fetch(`/api/private-tasks/${task.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: newComment.trim() }),
    })
    setPostingComment(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Nem sikerült menteni a bejegyzést')
      return
    }
    setNewComment('')
    setCommentsChanged(true)
    loadComments()
  }

  async function saveCommentEdit() {
    if (!task || !editingComment || !editingComment.body.trim()) return
    const res = await fetch(`/api/private-tasks/${task.id}/comments/${editingComment.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: editingComment.body.trim() }),
    })
    if (!res.ok) { setError('Nem sikerült menteni a bejegyzést'); return }
    setEditingComment(null)
    setCommentsChanged(true)
    loadComments()
  }

  async function deleteComment(commentId: string) {
    if (!task) return
    const res = await fetch(`/api/private-tasks/${task.id}/comments/${commentId}`, { method: 'DELETE' })
    if (!res.ok) { setError('Nem sikerült törölni a bejegyzést'); return }
    setCommentsChanged(true)
    loadComments()
  }

  /** Discards unsaved edits — the read-only view renders from this same state. */
  function resetFields() {
    setTitle(task?.title ?? '')
    setDescription(task?.description ?? '')
    setColumn(task?.column ?? defaultColumn)
    setPriority(task?.priority ?? 'MEDIUM')
    setDueDate(task?.dueDate ? task.dueDate.slice(0, 10) : '')
    setTicketId(task?.ticketId ?? defaultTicketId ?? '')
    setError('')
  }

  function close() {
    if (commentsChanged) onSaved()
    else onClose()
  }
  // Escape must run the current close(), which may need to refresh the board.
  const closeRef = useRef(close)
  closeRef.current = close

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') closeRef.current() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // A task may keep a link to a ticket that is no longer in the linkable list
  // (closed, or reassigned). Keep showing it so saving doesn't silently drop it.
  const staleLink = task?.ticket && !linkableTickets.some(t => t.id === task.ticket!.id)
    ? task.ticket
    : null

  const linkedTitle =
    linkableTickets.find(t => t.id === ticketId)?.title ??
    (staleLink && staleLink.id === ticketId ? `${staleLink.title} (már nem aktív)` : null)

  async function save() {
    if (!title.trim()) { setError('A cím megadása kötelező'); return }
    setSaving(true)
    setError('')
    const body = {
      title: title.trim(),
      description: description.trim() || null,
      column,
      priority,
      dueDate: dueDate || null,
      ticketId: ticketId || null,
    }
    const res = task
      ? await fetch(`/api/private-tasks/${task.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        })
      : await fetch('/api/private-tasks', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        })
    setSaving(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Nem sikerült menteni')
      return
    }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={close}>
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-xl shadow-xl max-h-[92vh] sm:max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-4 sm:px-5 py-3.5 border-b border-gray-100 flex items-center justify-between gap-2">
          <h2 className="font-semibold text-gray-900 text-sm sm:text-base min-w-0 truncate">
            {mode === 'edit'
              ? (task ? 'Feladat szerkesztése' : 'Új privát feladat')
              : 'Privát feladat'}
          </h2>
          <div className="flex items-center gap-1 shrink-0">
            {mode === 'view' && (
              <button onClick={() => setMode('edit')} title="Szerkesztés"
                className="text-gray-400 hover:text-indigo-600 p-1.5 rounded-lg hover:bg-gray-50">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              </button>
            )}
            <button onClick={close} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-50">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-3 overflow-y-auto">
          {error && <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

          {mode === 'view' ? (
            <>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 leading-snug break-words">{title}</h3>
                {description && (
                  <p className="text-sm text-gray-600 mt-1.5 whitespace-pre-wrap break-words">{description}</p>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                <Chip label="Oszlop" value={COLUMN_LABELS[column]} dot={COLUMN_COLORS[column]} />
                <Chip label="Prioritás" value={PRIORITY_LABELS[priority] || priority} />
                {dueDate && <Chip label="Határidő" value={formatDate(dueDate)} />}
                {linkedTitle && <Chip label="Kapcsolt feladat" value={linkedTitle} wide />}
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Cím</label>
                <input value={title} onChange={e => setTitle(e.target.value)} autoFocus
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  placeholder="Mit kell megcsinálni?" />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Leírás (opcionális)</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Oszlop</label>
                  <select value={column} onChange={e => setColumn(e.target.value as PrivateTaskColumnValue)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
                    {PRIVATE_TASK_COLUMNS.map(c => <option key={c} value={c}>{COLUMN_LABELS[c]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Prioritás</label>
                  <select value={priority} onChange={e => setPriority(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
                    {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Határidő</label>
                  <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Kapcsolódó publikus feladat</label>
                <select value={ticketId} onChange={e => setTicketId(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
                  <option value="">— Nincs kapcsolva —</option>
                  {staleLink && <option value={staleLink.id}>{staleLink.title} (már nem aktív)</option>}
                  {linkableTickets.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                </select>
                <p className="text-xs text-gray-400 mt-1.5">
                  {ticketId
                    ? 'A feladat felelőseként a neved és az utolsó frissítés dátuma megjelenik a publikus feladatnál. A privát feladat tartalmát senki más nem látja.'
                    : 'Kapcsolás nélkül ez a feladat sehol máshol nem jelenik meg.'}
                </p>
              </div>
            </>
          )}

          {/* Progress notes — the point of the view, so only hidden while editing */}
          {task && mode === 'view' && (
            <div className="pt-3 border-t border-gray-100">
              <label className="block text-xs font-medium text-gray-600 mb-2">
                Haladás {comments.length > 0 && <span className="text-gray-400">({comments.length})</span>}
              </label>

              {comments.length === 0 && (
                <p className="text-sm text-gray-400 mb-3">Még nincs bejegyzés. Írd le, hol tartasz.</p>
              )}

              {comments.length > 0 && (
                <ul className="space-y-2 mb-3">
                  {comments.map(c => (
                    <li key={c.id} className="bg-gray-50 rounded-xl px-3 py-2 group">
                      {editingComment?.id === c.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={editingComment.body}
                            onChange={e => setEditingComment({ id: c.id, body: e.target.value })}
                            rows={2}
                            className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                          />
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => setEditingComment(null)}
                              className="text-xs text-gray-500 hover:text-gray-700">Mégse</button>
                            <button onClick={saveCommentEdit}
                              className="text-xs font-medium text-indigo-600 hover:text-indigo-700">Mentés</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{c.body}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[11px] text-gray-400">
                              {formatDateTime(c.createdAt)}
                              {c.updatedAt !== c.createdAt && ' · szerkesztve'}
                            </span>
                            <div className="flex-1" />
                            <button onClick={() => setEditingComment({ id: c.id, body: c.body })}
                              className="text-[11px] text-gray-400 hover:text-indigo-600 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                              Szerkesztés
                            </button>
                            <button onClick={() => deleteComment(c.id)}
                              className="text-[11px] text-gray-400 hover:text-red-500 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                              Törlés
                            </button>
                          </div>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              <textarea
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                onKeyDown={e => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); addComment() }
                }}
                rows={3}
                placeholder="Hol tartasz?"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
              />
              <button onClick={addComment} disabled={postingComment || !newComment.trim()}
                className="mt-2 w-full px-4 py-2.5 text-sm font-medium text-white rounded-xl disabled:opacity-40 transition-opacity"
                style={{ background: '#6C5CE7' }}>
                {postingComment ? 'Mentés...' : 'Megjegyzés rögzítése'}
              </button>
              <p className="text-xs text-gray-400 mt-2">
                {ticketId
                  ? 'A bejegyzés frissíti a publikus feladatnál látszó dátumot — a szöveget senki más nem látja.'
                  : 'Csak te látod.'}
              </p>
            </div>
          )}
        </div>

        {mode === 'edit' && (
          <div className="px-4 sm:px-5 py-3.5 border-t border-gray-100 flex justify-end gap-2">
            <button
              onClick={() => { if (task) { resetFields(); setMode('view') } else close() }}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              Mégse
            </button>
            <button onClick={save} disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50"
              style={{ background: '#6C5CE7' }}>
              {saving ? 'Mentés...' : task ? 'Mentés' : 'Létrehozás'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function Chip({ label, value, dot, wide }: { label: string; value: string; dot?: string; wide?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5 ${wide ? 'max-w-full' : ''}`}>
      {dot && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: dot }} />}
      <span className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold shrink-0">{label}</span>
      <span className="text-xs text-gray-700 truncate">{value}</span>
    </span>
  )
}

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  PRIVATE_TASK_COLUMNS,
  COLUMN_LABELS,
  type PrivateTaskColumnValue,
} from '@/lib/private-tasks'
import type { PrivateTask, LinkableTicket, PrivateTaskComment } from '@/lib/private-tasks'
import { formatDateTime } from '@/lib/utils'

const PRIORITIES = [
  { value: 'LOW', label: 'Alacsony' },
  { value: 'MEDIUM', label: 'Közepes' },
  { value: 'HIGH', label: 'Magas' },
  { value: 'CRITICAL', label: 'Kritikus' },
]

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

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') closeRef.current() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

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

  function close() {
    if (commentsChanged) onSaved()
    else onClose()
  }
  // Escape must run the current close(), which may need to refresh the board.
  const closeRef = useRef(close)
  closeRef.current = close

  // A task may keep a link to a ticket that is no longer in the linkable list
  // (closed, or reassigned). Keep showing it so saving doesn't silently drop it.
  const staleLink = task?.ticket && !linkableTickets.some(t => t.id === task.ticket!.id)
    ? task.ticket
    : null

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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={close}>
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">
            {task ? 'Privát feladat szerkesztése' : 'Új privát feladat'}
          </h2>
          <button onClick={close} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-5 space-y-3 overflow-y-auto">
          {error && <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

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

          <div className="grid grid-cols-3 gap-3">
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

          {/* Progress notes — only once the task exists to attach them to */}
          {task && (
            <div className="pt-3 border-t border-gray-100">
              <label className="block text-xs font-medium text-gray-600 mb-2">
                Haladás {comments.length > 0 && <span className="text-gray-400">({comments.length})</span>}
              </label>

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
                              className="text-[11px] text-gray-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">
                              Szerkesztés
                            </button>
                            <button onClick={() => deleteComment(c.id)}
                              className="text-[11px] text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
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
                rows={2}
                placeholder="Hol tartasz? (Cmd/Ctrl + Enter a mentéshez)"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
              />
              <div className="flex items-center justify-between mt-1.5">
                <p className="text-xs text-gray-400">
                  {ticketId
                    ? 'A bejegyzés frissíti a publikus feladatnál látszó dátumot — a szöveget senki más nem látja.'
                    : 'Csak te látod.'}
                </p>
                <button onClick={addComment} disabled={postingComment || !newComment.trim()}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-700 disabled:text-gray-300 shrink-0 ml-3">
                  {postingComment ? 'Mentés...' : 'Hozzáadás'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={close} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Mégse</button>
          <button onClick={save} disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50"
            style={{ background: '#6C5CE7' }}>
            {saving ? 'Mentés...' : task ? 'Mentés' : 'Létrehozás'}
          </button>
        </div>
      </div>
    </div>
  )
}

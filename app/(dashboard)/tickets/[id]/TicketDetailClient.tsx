'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import PriorityBadge from '@/components/PriorityBadge'
import StatusBadge from '@/components/StatusBadge'
import Avatar from '@/components/Avatar'
import { formatRelativeTime, formatDateTime, displayName } from '@/lib/utils'

interface User { id: string; name: string | null; nickname?: string | null; email: string; role: string }
interface Attachment { id: string; fileUrl: string; fileName: string; fileSize: number; mimeType?: string | null }
interface NamedUser { id: string; name: string | null; nickname?: string | null; email: string; avatarUrl?: string | null }
interface Comment {
  id: string; body: string; isInternal: boolean; createdAt: string
  user: NamedUser
  attachments: Attachment[]
}
interface Activity { id: string; action: string; oldValue: string | null; newValue: string | null; createdAt: string; user: NamedUser }
interface Ticket {
  id: string; title: string; description: string; status: string; priority: string; createdAt: string; updatedAt: string
  category?: { id: string; name: string } | null
  assignee?: NamedUser | null
  createdBy: NamedUser
  comments: Comment[]
  activities: Activity[]
  attachments: Attachment[]
}

const MAX_FILE_SIZE = 50 * 1024 * 1024

function isImage(mimeType?: string | null, fileName?: string) {
  if (mimeType?.startsWith('image/')) return true
  if (!fileName) return false
  return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(fileName)
}

function FileList({ attachments }: { attachments: Attachment[] }) {
  if (!attachments.length) return null
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {attachments.map(a => (
        <a key={a.id} href={a.fileUrl} target="_blank" rel="noreferrer"
          className="group flex items-center gap-1.5 border border-gray-100 rounded-lg overflow-hidden hover:border-indigo-200 transition-colors bg-gray-50">
          {isImage(a.mimeType, a.fileName) ? (
            <img src={a.fileUrl} alt={a.fileName} className="w-10 h-10 object-cover flex-shrink-0" />
          ) : (
            <div className="w-10 h-10 flex items-center justify-center bg-indigo-50 flex-shrink-0">
              <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </div>
          )}
          <span className="text-xs text-gray-600 pr-3 group-hover:text-indigo-600 max-w-32 truncate">{a.fileName}</span>
        </a>
      ))}
    </div>
  )
}

function FileUploader({ onUploaded }: { onUploaded: (files: { fileUrl: string; fileName: string; fileSize: number; mimeType: string }[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [pending, setPending] = useState<{ fileUrl: string; fileName: string; fileSize: number; mimeType: string }[]>([])
  const [error, setError] = useState('')

  async function handleFiles(files: FileList) {
    setError('')
    const results: { fileUrl: string; fileName: string; fileSize: number; mimeType: string }[] = []
    setUploading(true)
    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE) {
        setError(`"${file.name}" túl nagy (max 50 MB)`)
        continue
      }
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      if (res.ok) {
        const d = await res.json()
        results.push({ fileUrl: d.url, fileName: d.fileName, fileSize: d.size, mimeType: file.type })
      }
    }
    setUploading(false)
    if (results.length) {
      const updated = [...pending, ...results]
      setPending(updated)
      onUploaded(updated)
    }
  }

  function remove(idx: number) {
    const updated = pending.filter((_, i) => i !== idx)
    setPending(updated)
    onUploaded(updated)
  }

  return (
    <div>
      {error && <p className="text-xs text-red-500 mb-1">{error}</p>}
      {pending.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {pending.map((f, i) => (
            <div key={i} className="flex items-center gap-1 bg-gray-100 rounded-lg px-2 py-1">
              {isImage(f.mimeType, f.fileName) ? (
                <img src={f.fileUrl} alt={f.fileName} className="w-6 h-6 object-cover rounded" />
              ) : (
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              )}
              <span className="text-xs text-gray-600 max-w-24 truncate">{f.fileName}</span>
              <button type="button" onClick={() => remove(i)} className="text-gray-400 hover:text-red-500 ml-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-indigo-300 transition-colors disabled:opacity-50"
      >
        {uploading ? (
          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        )}
        {uploading ? 'Feltöltés...' : 'Fájl csatolása (max 50 MB)'}
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={e => e.target.files && handleFiles(e.target.files)}
      />
    </div>
  )
}

export default function TicketDetailClient({ ticketId, user }: { ticketId: string; user: User }) {
  const router = useRouter()
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [agents, setAgents] = useState<{ id: string; name: string | null; email: string }[]>([])
  const [comment, setComment] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [commentAttachments, setCommentAttachments] = useState<{ fileUrl: string; fileName: string; fileSize: number; mimeType: string }[]>([])
  const [submittingComment, setSubmittingComment] = useState(false)
  const [savedReplies, setSavedReplies] = useState<{ id: string; title: string; body: string }[]>([])
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const loadTicket = useCallback(async () => {
    const r = await fetch(`/api/tickets/${ticketId}`)
    const d = await r.json()
    setTicket(d.ticket)
    setLoading(false)
  }, [ticketId])

  useEffect(() => {
    loadTicket()
    fetch('/api/categories').then(r => r.json()).then(d => setCategories(d.categories || []))
    fetch('/api/users').then(r => r.json()).then(d => setAgents(d.users || []))
    fetch('/api/saved-replies').then(r => r.json()).then(d => setSavedReplies(d.replies || []))
  }, [loadTicket])

  async function updateField(field: string, value: string | null) {
    const res = await fetch(`/api/tickets/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    })
    if (res.ok) loadTicket()
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault()
    if (!comment.trim() && commentAttachments.length === 0) return
    setSubmittingComment(true)

    const res = await fetch(`/api/tickets/${ticketId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: comment || '(csatolmány)', isInternal, attachments: commentAttachments }),
    })
    if (res.ok) {
      setComment('')
      setIsInternal(false)
      setCommentAttachments([])
      loadTicket()
    }
    setSubmittingComment(false)
  }

  async function deleteTicket() {
    setDeleting(true)
    const res = await fetch(`/api/tickets/${ticketId}`, { method: 'DELETE' })
    if (res.ok) {
      router.push('/dashboard')
    } else {
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  function actionLabel(activity: Activity) {
    const map: Record<string, string> = {
      created: 'létrehozta a ticketet',
      comment_added: 'megjegyzést fűzött',
      internal_note_added: 'belső megjegyzést adott',
      status_changed: `státuszt változtatott → ${activity.newValue}`,
      priority_changed: `prioritást változtatott → ${activity.newValue}`,
      assignee_changed: 'felelőst változtatott',
      category_changed: 'kategóriát változtatott',
    }
    return map[activity.action] || activity.action
  }

  if (loading) return <div className="p-6 text-gray-400">Betöltés...</div>
  if (!ticket) return <div className="p-6 text-gray-600">A ticket nem található</div>

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Breadcrumb + delete */}
      <div className="flex items-center justify-between gap-2 mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Link href="/dashboard" className="hover:text-gray-600">Vezérlőpult</Link>
          <span>/</span>
          <span className="text-gray-600 truncate">{ticket.title}</span>
        </div>
        {user.role === 'ADMIN' && (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 border border-red-100 hover:border-red-300 rounded-lg px-3 py-1.5 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Ticket törlése
          </button>
        )}
      </div>

      <div className="flex gap-6 flex-col lg:flex-row">
        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-4">
            <div className="flex items-start gap-3 mb-4">
              <Avatar name={ticket.createdBy.name} email={ticket.createdBy.email} avatarUrl={ticket.createdBy.avatarUrl} size="md" />
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold text-gray-900 mb-1">{ticket.title}</h1>
                <p className="text-xs text-gray-400">
                  Létrehozta: {displayName(ticket.createdBy) || ticket.createdBy.email} · {formatDateTime(ticket.createdAt)}
                </p>
              </div>
            </div>
            <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{ticket.description}</p>
            {ticket.attachments.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-500 mb-1">Csatolmányok</p>
                <FileList attachments={ticket.attachments} />
              </div>
            )}
          </div>

          {/* Comments */}
          <div className="space-y-3 mb-4">
            {ticket.comments.map(c => (
              <div key={c.id} className={`rounded-xl border shadow-sm p-5 ${c.isInternal ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100'}`}>
                <div className="flex items-center gap-2 mb-3">
                  <Avatar name={c.user.name} email={c.user.email} avatarUrl={c.user.avatarUrl} />
                  <span className="text-sm font-medium text-gray-700">{displayName(c.user) || c.user.email}</span>
                  {c.isInternal && <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-medium">Belső megjegyzés</span>}
                  <span className="text-xs text-gray-400 ml-auto">{formatRelativeTime(c.createdAt)}</span>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.body !== '(csatolmány)' ? c.body : ''}</p>
                {c.attachments.length > 0 && <FileList attachments={c.attachments} />}
              </div>
            ))}
          </div>

          {/* Add comment — READER cannot comment */}
          {user.role !== 'READER' && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <form onSubmit={submitComment}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-sm font-medium text-gray-700">Megjegyzés hozzáadása</span>
                  <label className="flex items-center gap-1.5 ml-auto cursor-pointer">
                    <div className={`relative w-9 h-5 rounded-full transition-colors ${isInternal ? 'bg-amber-400' : 'bg-gray-200'}`}
                      onClick={() => setIsInternal(!isInternal)}>
                      <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isInternal ? 'translate-x-4' : ''}`} />
                    </div>
                    <span className="text-xs text-gray-500">Belső megjegyzés</span>
                  </label>
                </div>

                {savedReplies.length > 0 && (
                  <select className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm mb-2 bg-white focus:outline-none focus:border-indigo-400"
                    onChange={e => { if (e.target.value) setComment(e.target.value); e.target.value = '' }}>
                    <option value="">Sablon válasz beillesztése...</option>
                    {savedReplies.map(r => <option key={r.id} value={r.body}>{r.title}</option>)}
                  </select>
                )}

                <textarea
                  rows={4}
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder={isInternal ? 'Belső megjegyzés (csak az agenteknek látható)...' : 'Írj megjegyzést...'}
                  className={`w-full px-3 py-2 border rounded-lg text-sm resize-none focus:outline-none mb-3 ${isInternal ? 'border-amber-200 bg-amber-50 focus:border-amber-400' : 'border-gray-200 focus:border-indigo-400'}`}
                />

                <div className="flex items-center justify-between gap-3">
                  <FileUploader onUploaded={setCommentAttachments} />
                  <button type="submit" disabled={submittingComment || (!comment.trim() && commentAttachments.length === 0)}
                    className="px-4 py-2 text-sm text-white font-medium rounded-xl disabled:opacity-60 flex-shrink-0"
                    style={{ background: '#6C5CE7' }}>
                    {submittingComment ? 'Küldés...' : 'Küldés'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-full lg:w-64 space-y-4 flex-shrink-0">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Részletek</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Státusz</label>
                {user.role === 'READER' ? (
                  <p className="text-sm text-gray-700 px-2 py-1.5">{{ OPEN: 'Nyitott', IN_PROGRESS: 'Folyamatban', AWAITING: 'Várakozó', CLOSED: 'Lezárt' }[ticket.status] ?? ticket.status}</p>
                ) : (
                  <select value={ticket.status} onChange={e => updateField('status', e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-indigo-400">
                    <option value="OPEN">Nyitott</option>
                    <option value="IN_PROGRESS">Folyamatban</option>
                    <option value="AWAITING">Várakozó</option>
                    <option value="CLOSED">Lezárt</option>
                  </select>
                )}
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Prioritás</label>
                {user.role === 'READER' ? (
                  <p className="text-sm text-gray-700 px-2 py-1.5">{{ LOW: 'Alacsony', MEDIUM: 'Közepes', HIGH: 'Magas', CRITICAL: 'Kritikus' }[ticket.priority] ?? ticket.priority}</p>
                ) : (
                  <select value={ticket.priority} onChange={e => updateField('priority', e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-indigo-400">
                    <option value="LOW">Alacsony</option>
                    <option value="MEDIUM">Közepes</option>
                    <option value="HIGH">Magas</option>
                    <option value="CRITICAL">Kritikus</option>
                  </select>
                )}
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Kategória</label>
                {user.role === 'READER' ? (
                  <p className="text-sm text-gray-700 px-2 py-1.5">{ticket.category?.name || '—'}</p>
                ) : (
                  <select value={ticket.category?.id || ''} onChange={e => updateField('categoryId', e.target.value || null)}
                    className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-indigo-400">
                    <option value="">Nincs</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Felelős</label>
                {user.role === 'READER' ? (
                  <p className="text-sm text-gray-700 px-2 py-1.5">{ticket.assignee ? (displayName(ticket.assignee) || ticket.assignee.email) : '—'}</p>
                ) : (
                  <select value={ticket.assignee?.id || ''} onChange={e => updateField('assigneeId', e.target.value || null)}
                    className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-indigo-400">
                    <option value="">Nincs hozzárendelve</option>
                    {agents.map(a => <option key={a.id} value={a.id}>{displayName(a) || a.email}</option>)}
                  </select>
                )}
              </div>
            </div>
          </div>

          {/* Activity log */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Tevékenység</h3>
            <div className="space-y-3">
              {ticket.activities.slice(0, 10).map(a => (
                <div key={a.id} className="flex gap-2.5">
                  <Avatar name={a.user.name} email={a.user.email} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-600">
                      <span className="font-medium">{displayName(a.user) || a.user.email.split('@')[0]}</span>{' '}
                      {actionLabel(a)}
                    </p>
                    <p className="text-xs text-gray-400">{formatRelativeTime(a.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Ticket törlése</h2>
                <p className="text-sm text-gray-500">Ez a művelet nem visszavonható.</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Biztosan törlöd a <strong>„{ticket.title}"</strong> ticketet? Az összes hozzászólás, csatolmány és tevékenység is törlődik.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">
                Mégse
              </button>
              <button onClick={deleteTicket} disabled={deleting}
                className="px-4 py-2 text-sm text-white font-medium rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-60">
                {deleting ? 'Törlés...' : 'Igen, töröld'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

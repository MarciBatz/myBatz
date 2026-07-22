'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import RichTextEditor, { type RichTextEditorHandle } from '@/components/RichTextEditor'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import PriorityBadge from '@/components/PriorityBadge'
import StatusBadge from '@/components/StatusBadge'
import Avatar from '@/components/Avatar'
import { formatRelativeTime, formatDateTime, fullDisplayName, buildUniqueDisplayNames } from '@/lib/utils'
import FileUpload from '@/components/FileUpload'
import AttachmentList from '@/components/AttachmentList'

interface User { id: string; name: string | null; nickname?: string | null; email: string; role: string }
interface Attachment { id: string; fileUrl: string; fileName: string; fileSize: number; mimeType?: string | null }
interface NamedUser { id: string; name: string | null; firstName?: string | null; lastName?: string | null; nickname?: string | null; email: string; avatarUrl?: string | null }
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

export default function TicketDetailClient({ ticketId, user }: { ticketId: string; user: User }) {
  const router = useRouter()
  const [ticket, setTicket] = useState<Ticket | null>(null)
  // Only ever an owner name and a timestamp — never the private tasks themselves.
  const [privateWork, setPrivateWork] = useState<{ ownerName: string; lastUpdatedAt: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [agents, setAgents] = useState<{ id: string; name: string | null; firstName?: string | null; lastName?: string | null; nickname?: string | null; email: string }[]>([])
  const [comment, setComment] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [commentAttachments, setCommentAttachments] = useState<{ fileUrl: string; fileName: string; fileSize: number; mimeType: string }[]>([])
  const [submittingComment, setSubmittingComment] = useState(false)
  const [savedReplies, setSavedReplies] = useState<{ id: string; title: string; body: string }[]>([])
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [canDeleteComments, setCanDeleteComments] = useState(false)
  const [canDeleteTickets, setCanDeleteTickets] = useState(false)
  const [deleteCommentTarget, setDeleteCommentTarget] = useState<string | null>(null)
  const [deletingComment, setDeletingComment] = useState(false)
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [commentText, setCommentText] = useState('')
  const editorRef = useRef<RichTextEditorHandle>(null)

  const loadTicket = useCallback(async () => {
    const r = await fetch(`/api/tickets/${ticketId}`)
    const d = await r.json()
    setTicket(d.ticket)
    setPrivateWork(d.privateWork ?? null)
    setLoading(false)
  }, [ticketId])

  // Auto-refresh so new comments/updates appear without a manual reload
  useEffect(() => {
    const interval = setInterval(() => { loadTicket() }, 15000)
    return () => clearInterval(interval)
  }, [loadTicket])

  useEffect(() => {
    loadTicket()
    fetch('/api/categories').then(r => r.json()).then(d => setCategories(d.categories || []))
    fetch('/api/users').then(r => r.json()).then(d => setAgents(d.users || []))
    fetch('/api/saved-replies').then(r => r.json()).then(d => setSavedReplies(d.replies || []))
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.user?.role === 'ADMIN') { setCanDeleteComments(true); setCanDeleteTickets(true); return }
      fetch(`/api/users/${d.user?.id}/settings`).then(r => r.json()).then(s => {
        setCanDeleteComments(s.permissions?.canDeleteComments === true)
        setCanDeleteTickets(s.permissions?.canDeleteTickets === true)
      })
    })
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
    if (!commentText.trim() && commentAttachments.length === 0) return
    setSubmittingComment(true)

    const res = await fetch(`/api/tickets/${ticketId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: comment || '(csatolmány)', isInternal, attachments: commentAttachments }),
    })
    if (res.ok) {
      setComment('')
      setCommentText('')
      setIsInternal(false)
      setCommentAttachments([])
      loadTicket()
    }
    setSubmittingComment(false)
  }

  async function deleteComment() {
    if (!deleteCommentTarget) return
    setDeletingComment(true)
    await fetch(`/api/tickets/${ticketId}/comments/${deleteCommentTarget}`, { method: 'DELETE' })
    setDeletingComment(false)
    setDeleteCommentTarget(null)
    loadTicket()
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
      created: 'létrehozta a feladatot',
      comment_added: 'megjegyzést fűzött',
      internal_note_added: 'belső megjegyzést adott',
      status_changed: `státuszt változtatott → ${activity.newValue}`,
      priority_changed: `prioritást változtatott → ${activity.newValue}`,
      assignee_changed: 'felelőst változtatott',
      category_changed: 'kategóriát változtatott',
      nudge_sent: `emlékeztette ${activity.newValue} felhasználót, hogy foglalkozzon a feladattal`,
    }
    return map[activity.action] || activity.action
  }

  if (loading) return <div className="p-6 text-gray-400">Betöltés...</div>
  if (!ticket) return <div className="p-6 text-gray-600">A feladat nem található</div>

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Breadcrumb + delete */}
      <div className="flex items-center justify-between gap-2 mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Link href="/dashboard" className="hover:text-gray-600">Vezérlőpult</Link>
          <span>/</span>
          <span className="text-gray-600 truncate">{ticket.title}</span>
        </div>
        {canDeleteTickets && (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 border border-red-100 hover:border-red-300 rounded-lg px-3 py-1.5 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Feladat törlése
          </button>
        )}
      </div>

      <div className="flex gap-6 flex-col lg:flex-row">
        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-4">
            <div className="flex items-start gap-3 mb-4">
              <Avatar name={ticket.createdBy.name} firstName={ticket.createdBy.firstName} lastName={ticket.createdBy.lastName} nickname={ticket.createdBy.nickname} email={ticket.createdBy.email} avatarUrl={ticket.createdBy.avatarUrl} size="md" />
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold text-gray-900 mb-1">{ticket.title}</h1>
                <p className="text-xs text-gray-400">
                  Létrehozta: {fullDisplayName(ticket.createdBy) || ticket.createdBy.email} · {formatDateTime(ticket.createdAt)}
                </p>
              </div>
            </div>
            <div className="prose text-sm text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: ticket.description.replace(/@\[([^\]]+)\]\([^)]+\)/g, (_, name) => `<strong class="text-indigo-600">@${name}</strong>`) }} />
            {ticket.attachments.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-500 mb-1">Csatolmányok</p>
                <AttachmentList attachments={ticket.attachments} />
              </div>
            )}
            {privateWork && (
              <div className="mt-4 pt-3 border-t border-gray-100 flex items-start gap-2">
                <svg className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <p className="text-xs text-gray-500 leading-relaxed">
                  <span className="font-medium text-gray-600">{privateWork.ownerName}</span> privát
                  feladatmenedzsmenten belül foglalkozik ezzel a feladattal.
                  {' '}Utolsó frissítés: <span className="font-medium text-gray-600">{formatDateTime(privateWork.lastUpdatedAt)}</span>
                  {privateWork.ownerName && user.id === ticket.assignee?.id && (
                    <> · <Link href="/private-tasks" className="text-indigo-500 hover:text-indigo-600">Megnyitás</Link></>
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Comments */}
          <div className="space-y-3 mb-4">
            {ticket.comments.map(c => (
              <div key={c.id} className={`rounded-xl border shadow-sm p-5 ${c.isInternal ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100'}`}>
                <div className="flex items-center gap-2 mb-3">
                  <Avatar name={c.user.name} firstName={c.user.firstName} lastName={c.user.lastName} nickname={c.user.nickname} email={c.user.email} avatarUrl={c.user.avatarUrl} />
                  <span className="text-sm font-medium text-gray-700">{fullDisplayName(c.user) || c.user.email}</span>
                  {c.isInternal && <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-medium">Belső megjegyzés</span>}
                  <span className="text-xs text-gray-400 ml-auto">{formatRelativeTime(c.createdAt)}</span>
                  {canDeleteComments && (
                    <button onClick={() => setDeleteCommentTarget(c.id)}
                      title="Hozzászólás törlése"
                      className="p-1 text-gray-300 hover:text-red-400 transition-colors rounded">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
                {c.body !== '(csatolmány)' ? (
                  <div className="prose text-sm text-gray-700"
                    dangerouslySetInnerHTML={{ __html: c.body.replace(/@\[([^\]]+)\]\([^)]+\)/g, (_, name) => `<strong class="text-indigo-600">@${name}</strong>`) }} />
                ) : null}
                {c.attachments.length > 0 && <AttachmentList attachments={c.attachments} />}
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
                    onChange={e => { if (e.target.value) { editorRef.current?.insertText(e.target.value) }; e.target.value = '' }}>
                    <option value="">Sablon válasz beillesztése...</option>
                    {savedReplies.map(r => <option key={r.id} value={r.body}>{r.title}</option>)}
                  </select>
                )}

                <div className="relative mb-3">
                  <RichTextEditor
                    editorRef={editorRef}
                    value={comment}
                    onChange={(html, text) => {
                      setComment(html)
                      setCommentText(text)
                      const atIdx = text.lastIndexOf('@')
                      if (atIdx !== -1 && !text.slice(atIdx).includes(' ') && text.slice(atIdx).length > 0) {
                        setMentionQuery(text.slice(atIdx + 1))
                      } else {
                        setMentionQuery(null)
                      }
                    }}
                    placeholder={isInternal ? 'Belső megjegyzés (csak az agenteknek látható)...' : 'Írj megjegyzést... (@névvel megemlíthetsz valakit)'}
                    minHeight="100px"
                  />
                  {mentionQuery !== null && (() => {
                    const uniqueNames = buildUniqueDisplayNames(agents)
                    const filtered = agents.filter(a => {
                      if (a.id === user.id) return false
                      const uname = uniqueNames[a.id] || a.email
                      return uname.toLowerCase().includes(mentionQuery.toLowerCase()) || a.email.toLowerCase().includes(mentionQuery.toLowerCase())
                    })
                    return (
                    <div className="absolute z-10 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-40 overflow-y-auto">
                      {'mindenki'.includes(mentionQuery.toLowerCase()) && (
                        <button type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 flex items-center gap-2 border-b border-gray-100"
                          onMouseDown={e => {
                            e.preventDefault()
                            editorRef.current?.replaceMentionQuery(mentionQuery ?? '', '@[mindenki](everyone) ')
                            setMentionQuery(null)
                          }}>
                          <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0" style={{ background: '#6C5CE7' }}>
                            @
                          </span>
                          <span className="font-medium text-indigo-700">mindenki</span>
                          <span className="text-xs text-gray-400 ml-1">— mindenkit értesít</span>
                        </button>
                      )}
                      {filtered.map(a => {
                        const uname = uniqueNames[a.id] || a.email
                        return (
                          <button key={a.id} type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                            onMouseDown={e => {
                              e.preventDefault()
                              const mentionTag = `@[${uname}](${a.id}) `
                              editorRef.current?.replaceMentionQuery(mentionQuery ?? '', mentionTag)
                              setMentionQuery(null)
                            }}>
                            <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0" style={{ background: '#6C5CE7' }}>
                              {uname[0].toUpperCase()}
                            </span>
                            <span>{uname}</span>
                          </button>
                        )
                      })}
                      {'mindenki'.includes(mentionQuery.toLowerCase()) === false && filtered.length === 0 && (
                        <p className="px-3 py-2 text-sm text-gray-400">Nincs találat</p>
                      )}
                    </div>
                    )
                  })()}
                </div>

                <div className="flex items-center justify-between gap-3">
                  <FileUpload value={commentAttachments} onChange={setCommentAttachments} />
                  <button type="submit" disabled={submittingComment || (!commentText.trim() && commentAttachments.length === 0)}
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
                  <p className="text-sm text-gray-700 px-2 py-1.5">{ticket.assignee ? (fullDisplayName(ticket.assignee) || ticket.assignee.email) : '—'}</p>
                ) : (
                  <select value={ticket.assignee?.id || ''} onChange={e => updateField('assigneeId', e.target.value || null)}
                    className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-indigo-400">
                    <option value="">Nincs hozzárendelve</option>
                    {agents.map(a => <option key={a.id} value={a.id}>{fullDisplayName(a) || a.email}</option>)}
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
                  <Avatar name={a.user.name} firstName={a.user.firstName} lastName={a.user.lastName} nickname={a.user.nickname} email={a.user.email} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-600">
                      <span className="font-medium">{fullDisplayName(a.user) || a.user.email.split('@')[0]}</span>{' '}
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
                <h2 className="text-lg font-semibold text-gray-900">Feladat törlése</h2>
                <p className="text-sm text-gray-500">Ez a művelet nem visszavonható.</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Biztosan törlöd a <strong>„{ticket.title}"</strong> feladatot? Az összes hozzászólás, csatolmány és tevékenység is törlődik.
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

      {/* Delete comment confirmation modal */}
      {deleteCommentTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Hozzászólás törlése</h2>
                <p className="text-sm text-gray-500">Ez a művelet nem visszavonható.</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-6">Biztosan törlöd ezt a hozzászólást?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteCommentTarget(null)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">
                Mégse
              </button>
              <button onClick={deleteComment} disabled={deletingComment}
                className="px-4 py-2 text-sm text-white font-medium rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-60">
                {deletingComment ? 'Törlés...' : 'Igen, töröld'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

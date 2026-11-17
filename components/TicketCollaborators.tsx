'use client'

import { useEffect, useRef, useState } from 'react'
import Avatar from './Avatar'
import { fullDisplayName } from '@/lib/utils'

export interface CollaboratorUser {
  id: string; name: string | null; firstName?: string | null; lastName?: string | null
  nickname?: string | null; email: string; avatarUrl?: string | null; lastSeenAt?: string | null
}

export interface Collaborator {
  id: string
  /** Null for a self-join — that is how the two cases are told apart. */
  addedById: string | null
  user: CollaboratorUser
}

/**
 * "Who else is on this" for a public ticket.
 *
 * The assignee is shown separately above and is never listed here: the ticket
 * still has exactly one owner, and this panel is deliberately not a second
 * assignee field.
 *
 * Who may do what is enforced on the server (lib/ticket-collaborators.ts); the
 * props below only decide what is worth rendering, so a stale page can't grant
 * anything — it can only show a button that comes back 403.
 */
export default function TicketCollaborators({
  ticketId,
  collaborators,
  viewerId,
  canManage,
  canJoin,
  onChanged,
}: {
  ticketId: string
  collaborators: Collaborator[]
  viewerId: string
  /** Creator, assignee or ADMIN: may add and remove other people. */
  canManage: boolean
  /** Everyone except READER may put themselves on it. */
  canJoin: boolean
  onChanged: () => void
}) {
  const [candidates, setCandidates] = useState<CollaboratorUser[]>([])
  const [picking, setPicking] = useState(false)
  const [query, setQuery] = useState('')
  const [busyUserId, setBusyUserId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const boxRef = useRef<HTMLDivElement | null>(null)

  const viewerIsCollaborator = collaborators.some(c => c.user.id === viewerId)

  // Only fetched once the picker is actually opened: the endpoint answers with
  // the staff list, and there is no reason to pull it on every ticket view.
  useEffect(() => {
    if (!picking) return
    fetch(`/api/tickets/${ticketId}/collaborators`)
      .then(r => r.json())
      .then(d => setCandidates(d.candidates || []))
      .catch(() => {})
  }, [picking, ticketId, collaborators.length])

  useEffect(() => {
    if (!picking) return
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setPicking(false)
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setPicking(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [picking])

  async function add(userId: string) {
    setBusyUserId(userId)
    setError('')
    const res = await fetch(`/api/tickets/${ticketId}/collaborators`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    setBusyUserId(null)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Nem sikerült rákapcsolni a kollégát')
      return
    }
    setQuery('')
    setPicking(false)
    onChanged()
  }

  async function remove(userId: string) {
    setBusyUserId(userId)
    setError('')
    const res = await fetch(`/api/tickets/${ticketId}/collaborators/${userId}`, { method: 'DELETE' })
    setBusyUserId(null)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Nem sikerült lekapcsolni a kollégát')
      return
    }
    onChanged()
  }

  const filtered = query.trim()
    ? candidates.filter(u => {
        const q = query.trim().toLowerCase()
        return (fullDisplayName(u) || '').toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
      })
    : candidates

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Rákapcsolódva {collaborators.length > 0 && `(${collaborators.length})`}
        </h3>
        {canManage && (
          <div className="relative" ref={boxRef}>
            <button type="button" onClick={() => setPicking(v => !v)}
              aria-expanded={picking}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-700 px-1.5 py-0.5 -mr-1.5 rounded hover:bg-indigo-50">
              + Kolléga
            </button>
            {picking && (
              <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-lg z-20 p-2">
                <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
                  placeholder="Keresés név vagy e-mail szerint"
                  className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm mb-1.5 focus:outline-none focus:border-indigo-400" />
                <div className="max-h-56 overflow-y-auto">
                  {filtered.length === 0 ? (
                    <p className="text-xs text-gray-400 px-2 py-2">
                      {candidates.length === 0 ? 'Nincs több rákapcsolható kolléga.' : 'Nincs találat.'}
                    </p>
                  ) : filtered.map(u => (
                    <button key={u.id} type="button" onClick={() => add(u.id)} disabled={busyUserId === u.id}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 text-left disabled:opacity-50">
                      <Avatar name={u.name} firstName={u.firstName} lastName={u.lastName} nickname={u.nickname}
                        email={u.email} avatarUrl={u.avatarUrl} size="sm" />
                      <span className="text-sm text-gray-700 truncate">{fullDisplayName(u) || u.email}</span>
                    </button>
                  ))}
                </div>
                {/* Said here rather than after the fact: adding someone from
                    another department is the point of the feature, but it does
                    hand them the ticket. */}
                <p className="text-[11px] text-gray-400 px-2 pt-1.5 mt-1 border-t border-gray-100">
                  A rákapcsolt kolléga látni fogja ezt a feladatot, akkor is, ha más részlegen van.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {collaborators.length === 0 ? (
        <p className="text-sm text-gray-400 mb-3">Rajta a felelősön kívül senki.</p>
      ) : (
        <div className="space-y-2 mb-3">
          {collaborators.map(c => {
            const canDrop = canManage || c.user.id === viewerId
            return (
              <div key={c.id} className="flex items-center gap-2.5 group">
                <Avatar name={c.user.name} firstName={c.user.firstName} lastName={c.user.lastName}
                  nickname={c.user.nickname} email={c.user.email} avatarUrl={c.user.avatarUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-800 truncate">
                    {fullDisplayName(c.user) || c.user.email}
                    {c.user.id === viewerId && <span className="text-xs text-gray-400"> — te</span>}
                  </p>
                  <p className="text-[11px] text-gray-400">
                    {c.addedById ? 'rákapcsolták' : 'maga kapcsolódott rá'}
                  </p>
                </div>
                {canDrop && (
                  <button type="button" onClick={() => remove(c.user.id)} disabled={busyUserId === c.user.id}
                    title={c.user.id === viewerId ? 'Lekapcsolódom' : 'Lekapcsolás'}
                    className="p-1 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 disabled:opacity-50">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {canJoin && (
        viewerIsCollaborator ? (
          <button type="button" onClick={() => remove(viewerId)} disabled={busyUserId === viewerId}
            className="w-full px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-60">
            Lekapcsolódom
          </button>
        ) : (
          <button type="button" onClick={() => add(viewerId)} disabled={busyUserId === viewerId}
            className="w-full px-3 py-2 text-sm font-medium rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50 disabled:opacity-60">
            Rákapcsolódom
          </button>
        )
      )}

      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
    </div>
  )
}

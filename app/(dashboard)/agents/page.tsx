'use client'

import { useState, useEffect } from 'react'
import Avatar from '@/components/Avatar'
import { formatDate, displayName } from '@/lib/utils'

interface AgentUser {
  id: string; email: string; name: string | null; nickname?: string | null; role: string; status: string; avatarUrl: string | null; createdAt: string
}

export default function AgentsPage() {
  const [users, setUsers] = useState<AgentUser[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<{ id: string; role: string } | null>(null)

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<AgentUser | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Invite modal
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteLastName, setInviteLastName] = useState('')
  const [inviteFirstName, setInviteFirstName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('AGENT')
  const [inviteSendEmail, setInviteSendEmail] = useState(true)
  const [inviteError, setInviteError] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)

  // Link copy modal
  const [inviteLink, setInviteLink] = useState('')
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    loadUsers()
    fetch('/api/auth/me').then(r => r.json()).then(d => setCurrentUser(d.user))
  }, [])

  async function loadUsers() {
    const r = await fetch('/api/users')
    const d = await r.json()
    setUsers(d.users || [])
    setLoading(false)
  }

  function openInviteModal() {
    setInviteLastName('')
    setInviteFirstName('')
    setInviteEmail('')
    setInviteRole('AGENT')
    setInviteSendEmail(true)
    setInviteError('')
    setShowInviteModal(true)
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviteError('')
    setInviteLoading(true)

    const fullName = `${inviteLastName} ${inviteFirstName}`.trim()

    const res = await fetch('/api/users/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail, name: fullName, role: inviteRole, sendEmail: inviteSendEmail }),
    })
    const data = await res.json()
    if (!res.ok) {
      setInviteError(data.error || 'Sikertelen meghívás')
      setInviteLoading(false)
      return
    }

    setShowInviteModal(false)
    setInviteLoading(false)
    setInviteLink(data.inviteLink)
    setCopied(false)
    setShowLinkModal(true)
    loadUsers()
  }

  async function resendInvite(userId: string) {
    const res = await fetch(`/api/users/${userId}/resend-invite`, { method: 'POST' })
    const data = await res.json()
    if (data.inviteLink) {
      setInviteLink(data.inviteLink)
      setCopied(false)
      setShowLinkModal(true)
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function deleteUser() {
    if (!deleteTarget) return
    setDeleting(true)
    await fetch(`/api/users/${deleteTarget.id}`, { method: 'DELETE' })
    setDeleting(false)
    setDeleteTarget(null)
    loadUsers()
  }

  async function toggleStatus(userId: string, currentStatus: string) {
    const newStatus = currentStatus === 'ACTIVE' ? 'DISABLED' : 'ACTIVE'
    await fetch(`/api/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    loadUsers()
  }

  const isAdmin = currentUser?.role === 'ADMIN'

  const statusLabel: Record<string, string> = {
    ACTIVE: 'Aktív',
    INVITED: 'Meghívott',
    DISABLED: 'Letiltott',
  }

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      ACTIVE: 'bg-green-100 text-green-700',
      INVITED: 'bg-blue-100 text-blue-700',
      DISABLED: 'bg-gray-100 text-gray-500',
    }
    return map[status] || map.ACTIVE
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Munkatársak</h1>
          <p className="text-gray-500 text-sm mt-0.5">Csapattagok kezelése</p>
        </div>
        {isAdmin && (
          <button onClick={openInviteModal}
            className="flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-xl"
            style={{ background: '#6C5CE7' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            Meghívó küldése
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-gray-400">Betöltés...</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-gray-400 uppercase tracking-wider border-b border-gray-100">
                <th className="px-5 py-3 font-medium">Munkatárs</th>
                <th className="px-4 py-3 font-medium">Szerepkör</th>
                <th className="px-4 py-3 font-medium">Státusz</th>
                <th className="px-4 py-3 font-medium">Csatlakozott</th>
                {isAdmin && <th className="px-4 py-3 font-medium">Műveletek</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-gray-50/50">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={u.name} email={u.email} avatarUrl={u.avatarUrl} size="md" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{displayName(u) || '—'}</p>
                        <p className="text-xs text-gray-400">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${
                      u.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' :
                      u.role === 'READER' ? 'bg-teal-100 text-teal-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {u.role === 'ADMIN' ? 'Adminisztrátor' : u.role === 'READER' ? 'Olvasó' : 'Felhasználó'}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${statusBadge(u.status)}`}>
                      {statusLabel[u.status] || u.status}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-xs text-gray-400">{formatDate(u.createdAt)}</span>
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        {u.status === 'INVITED' && (
                          <button onClick={() => resendInvite(u.id)}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                            Link újragenerálása
                          </button>
                        )}
                        {u.status !== 'INVITED' && (
                          <button onClick={() => toggleStatus(u.id, u.status)}
                            className={`text-xs font-medium ${u.status === 'ACTIVE' ? 'text-orange-500 hover:text-orange-700' : 'text-green-600 hover:text-green-800'}`}>
                            {u.status === 'ACTIVE' ? 'Letiltás' : 'Engedélyezés'}
                          </button>
                        )}
                        {currentUser?.id !== u.id && (
                          <button onClick={() => setDeleteTarget(u)}
                            className="text-xs font-medium text-red-400 hover:text-red-600">
                            Törlés
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Invite modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Új munkatárs meghívása</h2>
              <button onClick={() => setShowInviteModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleInvite} className="p-6 space-y-4">
              {inviteError && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{inviteError}</div>}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Vezetéknév</label>
                  <input type="text" required value={inviteLastName} onChange={e => setInviteLastName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400"
                    placeholder="Nagy" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Keresztnév</label>
                  <input type="text" required value={inviteFirstName} onChange={e => setInviteFirstName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400"
                    placeholder="Béla" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email cím</label>
                <input type="email" required value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400"
                  placeholder="nagy.bela@batz.hu" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Szerepkör</label>
                <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-indigo-400">
                  <option value="AGENT">Felhasználó</option>
                  <option value="ADMIN">Adminisztrátor</option>
                  <option value="READER">Olvasó</option>
                </select>
              </div>
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div className={`relative w-10 h-5 rounded-full transition-colors ${inviteSendEmail ? '' : 'bg-gray-200'}`}
                  style={inviteSendEmail ? { background: '#6C5CE7' } : {}}
                  onClick={() => setInviteSendEmail(!inviteSendEmail)}>
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${inviteSendEmail ? 'translate-x-5' : ''}`} />
                </div>
                <span className="text-sm text-gray-700">Meghívó e-mail küldése a felhasználónak</span>
              </label>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">Mégse</button>
                <button type="submit" disabled={inviteLoading}
                  className="px-4 py-2 text-sm text-white font-medium rounded-xl disabled:opacity-60"
                  style={{ background: '#6C5CE7' }}>
                  {inviteLoading ? 'Generálás...' : 'Meghívó létrehozása'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">Fiók törlése</h3>
                <p className="text-sm text-gray-500">Ez a művelet nem visszavonható.</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Biztosan törlöd <strong>{deleteTarget.name || deleteTarget.email}</strong> fiókját? A felhasználó összes adata törlődik.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">
                Mégse
              </button>
              <button onClick={deleteUser} disabled={deleting}
                className="px-4 py-2 text-sm text-white font-medium rounded-xl disabled:opacity-60 bg-red-500 hover:bg-red-600">
                {deleting ? 'Törlés...' : 'Fiók törlése'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Link copy modal */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Meghívó link</h2>
              <button onClick={() => setShowLinkModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                Másold ki az alábbi linket és küldd el a meghívott munkatársnak. A link <strong>72 óráig</strong> érvényes.
              </p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={inviteLink}
                  className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none"
                />
                <button
                  onClick={copyLink}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl text-white transition-all"
                  style={{ background: copied ? '#10B981' : '#6C5CE7' }}
                >
                  {copied ? (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Másolva!
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Másolás
                    </>
                  )}
                </button>
              </div>
              <div className="flex justify-end pt-2">
                <button onClick={() => setShowLinkModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">
                  Bezárás
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

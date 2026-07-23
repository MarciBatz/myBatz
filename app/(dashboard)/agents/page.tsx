'use client'

import { useState, useEffect } from 'react'
import Avatar from '@/components/Avatar'
import { formatDate, fullDisplayName, buildUniqueDisplayNames, isOnline, formatLastSeen } from '@/lib/utils'

interface AgentUser {
  id: string; email: string; name: string | null; firstName?: string | null; lastName?: string | null; nickname?: string | null; role: string; status: string; avatarUrl: string | null; createdAt: string; lastSeenAt: string | null
}

interface UserSettings {
  preferences: {
    notifyTickets: boolean
    notifyCalendarSzuronap: boolean
    notifyCalendarHetes: boolean
    notifyCalendarEgyeb: boolean
    excludeFromOfficeRotation: boolean
  } | null
  permissions: {
    canRegenerateOfficeSchedule: boolean
    canManageEmailNotifications: boolean
    canSendInvites: boolean
    canDeleteTickets: boolean
    canDeleteComments: boolean
    canManageCategories: boolean
  } | null
}

export default function AgentsPage() {
  const [users, setUsers] = useState<AgentUser[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<{ id: string; role: string } | null>(null)

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<AgentUser | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Role change confirmation
  const [roleChangeTarget, setRoleChangeTarget] = useState<{ user: AgentUser; newRole: string } | null>(null)
  const [changingRole, setChangingRole] = useState(false)

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

  // Settings modal
  const [settingsTarget, setSettingsTarget] = useState<AgentUser | null>(null)
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [settingsSaving, setSettingsSaving] = useState(false)

  // Regenerate schedule
  const [regenerating, setRegenerating] = useState(false)

  // Non-admin permissions
  const [canSendInvites, setCanSendInvites] = useState(false)
  const [canRegenerateOfficeSchedule, setCanRegenerateOfficeSchedule] = useState(false)
  const [canManageEmailNotifications, setCanManageEmailNotifications] = useState(false)

  useEffect(() => {
    loadUsers()
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      setCurrentUser(d.user)
      if (d.user?.role === 'ADMIN') {
        setCanSendInvites(true)
        setCanRegenerateOfficeSchedule(true)
        setCanManageEmailNotifications(true)
      } else if (d.user?.id) {
        fetch(`/api/users/${d.user.id}/settings`).then(r => r.json()).then(s => {
          setCanSendInvites(s.permissions?.canSendInvites === true)
          setCanRegenerateOfficeSchedule(s.permissions?.canRegenerateOfficeSchedule === true)
          setCanManageEmailNotifications(s.permissions?.canManageEmailNotifications === true)
        })
      }
    })
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
    const res = await fetch(`/api/users/${deleteTarget.id}`, { method: 'DELETE' })
    setDeleting(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.error || 'Nem sikerült törölni a felhasználót')
      return
    }
    setDeleteTarget(null)
    loadUsers()
  }

  async function confirmRoleChange() {
    if (!roleChangeTarget) return
    setChangingRole(true)
    await fetch(`/api/users/${roleChangeTarget.user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: roleChangeTarget.newRole }),
    })
    setChangingRole(false)
    setRoleChangeTarget(null)
    loadUsers()
  }

  async function openSettings(user: AgentUser) {
    setSettingsTarget(user)
    setSettings(null)
    setSettingsLoading(true)
    const res = await fetch(`/api/users/${user.id}/settings`)
    const data = await res.json()
    const defaults = {
      notifyTickets: true, notifyCalendarSzuronap: true,
      notifyCalendarHetes: true, notifyCalendarEgyeb: true,
      excludeFromOfficeRotation: false,
    }
    const defaultPerms = {
      canRegenerateOfficeSchedule: false, canManageEmailNotifications: false,
      canSendInvites: false, canDeleteTickets: false, canDeleteComments: false, canManageCategories: false,
    }
    setSettings({
      preferences: { ...defaults, ...(data.preferences || {}) },
      permissions: { ...defaultPerms, ...(data.permissions || {}) },
    })
    setSettingsLoading(false)
  }

  async function saveSettings() {
    if (!settingsTarget || !settings) return
    setSettingsSaving(true)
    await fetch(`/api/users/${settingsTarget.id}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preferences: settings.preferences, permissions: settings.permissions }),
    })
    setSettingsSaving(false)
    setSettingsTarget(null)
  }

  async function regenerateSchedule() {
    setRegenerating(true)
    const res = await fetch('/api/office-weeks/regenerate', { method: 'POST' })
    setRegenerating(false)
    if (!res.ok) {
      alert('Nem sikerült újragenerálni a beosztást.')
    }
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
  const nameMap = buildUniqueDisplayNames(users)

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
        <div className="flex items-center gap-2">
          {canRegenerateOfficeSchedule && (
            <button onClick={regenerateSchedule} disabled={regenerating}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-60">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {regenerating ? 'Generálás...' : 'Irodai beosztás újragenerálása'}
            </button>
          )}
          {canSendInvites && (
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
                <th className="px-4 py-3 font-medium">Utoljára aktív</th>
                <th className="px-4 py-3 font-medium">Csatlakozott</th>
                {isAdmin && <th className="px-4 py-3 font-medium">Műveletek</th>}
                {canManageEmailNotifications && <th className="px-4 py-3 font-medium"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-gray-50/50">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={u.name} firstName={u.firstName} lastName={u.lastName} nickname={u.nickname} email={u.email} avatarUrl={u.avatarUrl} size="md" online={isOnline(u.lastSeenAt)} />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{nameMap[u.id] || '—'}</p>
                        <p className="text-xs text-gray-400">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    {isAdmin && currentUser?.id !== u.id ? (
                      <select
                        value={u.role}
                        onChange={e => setRoleChangeTarget({ user: u, newRole: e.target.value })}
                        className={`text-xs font-medium rounded-md px-2 py-0.5 border-0 focus:outline-none focus:ring-1 focus:ring-indigo-400 cursor-pointer ${
                          u.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' :
                          u.role === 'READER' ? 'bg-teal-100 text-teal-700' :
                          'bg-gray-100 text-gray-600'
                        }`}
                      >
                        <option value="AGENT">Felhasználó</option>
                        <option value="ADMIN">Adminisztrátor</option>
                        <option value="READER">Olvasó</option>
                      </select>
                    ) : (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${
                        u.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' :
                        u.role === 'READER' ? 'bg-teal-100 text-teal-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {u.role === 'ADMIN' ? 'Adminisztrátor' : u.role === 'READER' ? 'Olvasó' : 'Felhasználó'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${statusBadge(u.status)}`}>
                      {statusLabel[u.status] || u.status}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`text-xs font-medium ${isOnline(u.lastSeenAt) ? 'text-green-600' : 'text-gray-400'}`}>
                      {formatLastSeen(u.lastSeenAt)}
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
                  {canManageEmailNotifications && (
                    <td className="px-4 py-4">
                      <button onClick={() => openSettings(u)} title="Beállítások"
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </button>
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
              Biztosan törlöd <strong>{fullDisplayName(deleteTarget) || deleteTarget.email}</strong> fiókját? A felhasználó összes adata törlődik.
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

      {/* Role change confirmation modal */}
      {roleChangeTarget && (() => {
        const roleLabels: Record<string, string> = { ADMIN: 'Adminisztrátor', AGENT: 'Felhasználó', READER: 'Olvasó' }
        const userName = roleChangeTarget.user.name || roleChangeTarget.user.email
        const oldRole = roleLabels[roleChangeTarget.user.role]
        const newRole = roleLabels[roleChangeTarget.newRole]
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#f0edff' }}>
                  <svg className="w-5 h-5" style={{ color: '#6C5CE7' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Szerepkör módosítása</h3>
                  <p className="text-sm text-gray-500">Az érintett felhasználó e-mail értesítőt kap.</p>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-6">
                Biztosan megváltoztatod <strong>{userName}</strong> szerepkörét{' '}
                <strong>{oldRole}</strong>-ról <strong>{newRole}</strong>-ra?
              </p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setRoleChangeTarget(null)}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">
                  Mégse
                </button>
                <button onClick={confirmRoleChange} disabled={changingRole}
                  className="px-4 py-2 text-sm text-white font-medium rounded-xl disabled:opacity-60"
                  style={{ background: '#6C5CE7' }}>
                  {changingRole ? 'Módosítás...' : 'Igen, megváltoztatom'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Settings modal */}
      {settingsTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Beállítások</h2>
                <p className="text-sm text-gray-400">{fullDisplayName(settingsTarget) || settingsTarget.email}</p>
              </div>
              <button onClick={() => setSettingsTarget(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {settingsLoading || !settings ? (
              <div className="py-12 text-center text-gray-400 text-sm">Betöltés...</div>
            ) : (
              <div className="p-6 space-y-6">
                {/* Email notifications */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">E-mail értesítések</h3>
                  <div className="space-y-2.5">
                    {([
                      { key: 'notifyTickets', label: 'Feladatok' },
                      { key: 'notifyCalendarSzuronap', label: 'Szűrőnapok' },
                      { key: 'notifyCalendarHetes', label: 'Irodai hetes' },
                      { key: 'notifyCalendarEgyeb', label: 'Egyéb naptáresemény' },
                    ] as const).map(({ key, label }) => (
                      <label key={key} className="flex items-center justify-between cursor-pointer">
                        <span className="text-sm text-gray-600">{label}</span>
                        <div
                          className="relative w-10 h-5 rounded-full transition-colors cursor-pointer"
                          style={{ background: settings.preferences?.[key] ? '#6C5CE7' : '#e5e7eb' }}
                          onClick={() => setSettings(s => s ? {
                            ...s,
                            preferences: { ...s.preferences!, [key]: !s.preferences?.[key] }
                          } : s)}
                        >
                          <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${settings.preferences?.[key] ? 'translate-x-5' : ''}`} />
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Office rotation */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Irodai hetes rotáció</h3>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm text-gray-600">Kizárás a rotációból</span>
                    <div
                      className="relative w-10 h-5 rounded-full transition-colors cursor-pointer"
                      style={{ background: settings.preferences?.excludeFromOfficeRotation ? '#ef4444' : '#e5e7eb' }}
                      onClick={() => setSettings(s => s ? {
                        ...s,
                        preferences: { ...s.preferences!, excludeFromOfficeRotation: !s.preferences?.excludeFromOfficeRotation }
                      } : s)}
                    >
                      <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${settings.preferences?.excludeFromOfficeRotation ? 'translate-x-5' : ''}`} />
                    </div>
                  </label>
                </div>

                {/* Permissions (admin only) */}
                {settingsTarget.role !== 'ADMIN' && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Jogosultságok</h3>
                    <div className="space-y-2.5">
                      {([
                        { key: 'canRegenerateOfficeSchedule', label: 'Irodai hetes beosztás újragenerálása' },
                        { key: 'canManageEmailNotifications', label: 'E-mail értesítési beállítások módosítása' },
                        { key: 'canSendInvites', label: 'Meghívó küldése' },
                        { key: 'canDeleteTickets', label: 'Ticketek törlése' },
                        { key: 'canDeleteComments', label: 'Hozzászólások törlése' },
                        { key: 'canManageCategories', label: 'Kategóriák kezelése' },
                      ] as const).map(({ key, label }) => (
                        <label key={key} className="flex items-center justify-between cursor-pointer">
                          <span className="text-sm text-gray-600">{label}</span>
                          <div
                            className="relative w-10 h-5 rounded-full transition-colors cursor-pointer"
                            style={{ background: settings.permissions?.[key] ? '#6C5CE7' : '#e5e7eb' }}
                            onClick={() => setSettings(s => s ? {
                              ...s,
                              permissions: { ...s.permissions!, [key]: !s.permissions?.[key] }
                            } : s)}
                          >
                            <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${settings.permissions?.[key] ? 'translate-x-5' : ''}`} />
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                {settingsTarget.role === 'ADMIN' && (
                  <p className="text-xs text-gray-400 italic">Az adminisztrátorok automatikusan rendelkeznek minden jogosultsággal.</p>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <button onClick={() => setSettingsTarget(null)}
                    className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">Mégse</button>
                  <button onClick={saveSettings} disabled={settingsSaving}
                    className="px-4 py-2 text-sm text-white font-medium rounded-xl disabled:opacity-60"
                    style={{ background: '#6C5CE7' }}>
                    {settingsSaving ? 'Mentés...' : 'Mentés'}
                  </button>
                </div>
              </div>
            )}
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

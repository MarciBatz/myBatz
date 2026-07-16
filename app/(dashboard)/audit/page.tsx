'use client'

import { useState, useEffect, useCallback } from 'react'
import Avatar from '@/components/Avatar'
import { formatDateTime } from '@/lib/utils'

interface AuditEntry {
  id: string
  action: string
  detail: string | null
  ip: string | null
  createdAt: string
  user: { id: string; name: string | null; firstName?: string | null; nickname?: string | null; email: string; avatarUrl?: string | null } | null
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  login:           { label: 'Bejelentkezés',       color: 'bg-green-100 text-green-700' },
  profile_updated: { label: 'Profil módosítva',    color: 'bg-blue-100 text-blue-700' },
  role_changed:    { label: 'Szerepkör változás',  color: 'bg-purple-100 text-purple-700' },
  status_changed:  { label: 'Státusz változás',    color: 'bg-orange-100 text-orange-700' },
  user_invited:    { label: 'Felhasználó meghívva', color: 'bg-indigo-100 text-indigo-700' },
  user_deleted:    { label: 'Felhasználó törölve', color: 'bg-red-100 text-red-700' },
}

const ACTION_OPTIONS = [
  { value: '', label: 'Minden esemény' },
  { value: 'login', label: 'Bejelentkezések' },
  { value: 'profile_updated', label: 'Profil módosítások' },
  { value: 'role_changed', label: 'Szerepkör változások' },
  { value: 'user_invited', label: 'Meghívások' },
  { value: 'user_deleted', label: 'Törlések' },
]

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<{ id: string; name: string | null; email: string }[]>([])
  const [userId, setUserId] = useState('')
  const [action, setAction] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    fetch('/api/users').then(r => r.json()).then(d => setUsers(d.users || []))
  }, [])

  const loadLogs = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (userId) params.set('userId', userId)
    if (action) params.set('action', action)
    params.set('page', String(page))

    const r = await fetch(`/api/audit-logs?${params}`)
    const d = await r.json()
    setLogs(d.logs || [])
    setTotal(d.total || 0)
    setLoading(false)
  }, [userId, action, page])

  useEffect(() => { loadLogs() }, [loadLogs])

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Audit napló</h1>
        <p className="text-gray-500 text-sm mt-0.5">Bejelentkezések és rendszeresemények naplója</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4 flex gap-3 flex-wrap">
        <select value={userId} onChange={e => { setUserId(e.target.value); setPage(1) }}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-indigo-400">
          <option value="">Minden felhasználó</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
        </select>
        <select value={action} onChange={e => { setAction(e.target.value); setPage(1) }}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-indigo-400">
          {ACTION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <span className="text-sm text-gray-500">{total} bejegyzés</span>
        </div>
        {loading ? (
          <div className="py-12 text-center text-gray-400">Betöltés...</div>
        ) : logs.length === 0 ? (
          <div className="py-12 text-center text-gray-400">Nincs bejegyzés</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {logs.map(log => {
              const meta = ACTION_LABELS[log.action] || { label: log.action, color: 'bg-gray-100 text-gray-600' }
              const userName = log.user
                ? (log.user.nickname || log.user.firstName || log.user.name || log.user.email)
                : 'Törölt felhasználó'
              return (
                <div key={log.id} className="flex items-start gap-4 px-5 py-4">
                  {log.user ? (
                    <Avatar name={log.user.name} firstName={log.user.firstName} nickname={log.user.nickname} email={log.user.email} avatarUrl={log.user.avatarUrl} />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 text-xs flex-shrink-0">?</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900">{userName}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${meta.color}`}>
                        {meta.label}
                      </span>
                      {log.detail && (
                        <span className="text-xs text-gray-500">{log.detail}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <p className="text-xs text-gray-400">{formatDateTime(log.createdAt)}</p>
                      {log.ip && <p className="text-xs text-gray-300">{log.ip}</p>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        {total > 50 && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-400">{page}. oldal / {Math.ceil(total / 50)}</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">Előző</button>
              <button disabled={page >= Math.ceil(total / 50)} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">Következő</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

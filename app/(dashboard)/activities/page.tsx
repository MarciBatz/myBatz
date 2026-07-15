'use client'

import { useState, useEffect, useCallback } from 'react'
import Avatar from '@/components/Avatar'
import Link from 'next/link'
import { formatDateTime } from '@/lib/utils'

interface Activity {
  id: string; action: string; oldValue: string | null; newValue: string | null; createdAt: string
  user: { id: string; name: string | null; email: string; avatarUrl?: string | null }
  ticket: { id: string; title: string }
}

const ACTION_LABELS: Record<string, string> = {
  created: 'létrehozta a ticketet:',
  comment_added: 'megjegyzést fűzött ehhez:',
  internal_note_added: 'belső megjegyzést fűzött ehhez:',
  status_changed: 'megváltoztatta a státuszt:',
  priority_changed: 'megváltoztatta a prioritást:',
  assignee_changed: 'megváltoztatta a felelőst:',
  category_changed: 'megváltoztatta a kategóriát:',
}

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<{ id: string; name: string | null; email: string }[]>([])
  const [userId, setUserId] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    fetch('/api/users').then(r => r.json()).then(d => setUsers(d.users || []))
  }, [])

  const loadActivities = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (userId) params.set('userId', userId)
    params.set('page', String(page))

    const r = await fetch(`/api/activities?${params}`)
    const d = await r.json()
    setActivities(d.activities || [])
    setTotal(d.total || 0)
    setLoading(false)
  }, [userId, page])

  useEffect(() => { loadActivities() }, [loadActivities])

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Tevékenységek</h1>
        <p className="text-gray-500 text-sm mt-0.5">Globális tevékenységnapló</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4 flex gap-3 flex-wrap">
        <select value={userId} onChange={e => { setUserId(e.target.value); setPage(1) }}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-indigo-400">
          <option value="">Minden felhasználó</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <span className="text-sm text-gray-500">{total} tevékenység</span>
        </div>
        {loading ? (
          <div className="py-12 text-center text-gray-400">Betöltés...</div>
        ) : activities.length === 0 ? (
          <div className="py-12 text-center text-gray-400">Nincs tevékenység</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {activities.map(a => (
              <div key={a.id} className="flex items-start gap-4 px-5 py-4">
                <Avatar name={a.user.name} email={a.user.email} avatarUrl={a.user.avatarUrl} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">{a.user.name || a.user.email}</span>{' '}
                    {ACTION_LABELS[a.action] || a.action}{' '}
                    <Link href={`/tickets/${a.ticket.id}`} className="font-medium text-indigo-600 hover:underline">
                      {a.ticket.title}
                    </Link>
                    {a.oldValue && a.newValue && a.action.includes('changed') && (
                      <span className="text-gray-400"> ({a.oldValue} → {a.newValue})</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(a.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        {total > 50 && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-400">Page {page} of {Math.ceil(total / 50)}</span>
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

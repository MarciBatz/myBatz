'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Avatar from '@/components/Avatar'
import Link from 'next/link'
import { formatDateTime } from '@/lib/utils'

interface Activity {
  id: string; action: string; oldValue: string | null; newValue: string | null; createdAt: string
  user: { id: string; name: string | null; firstName?: string | null; nickname?: string | null; email: string; avatarUrl?: string | null } | null
  ticket: { id: string; title: string }
}

interface AuditEntry {
  id: string; action: string; detail: string | null; ip: string | null; createdAt: string
  user: { id: string; name: string | null; firstName?: string | null; nickname?: string | null; email: string; avatarUrl?: string | null } | null
}

type FeedItem =
  | { kind: 'activity'; createdAt: string; data: Activity }
  | { kind: 'audit'; createdAt: string; data: AuditEntry }

const ACTIVITY_LABELS: Record<string, string> = {
  created: 'létrehozta a feladatot:',
  comment_added: 'megjegyzést fűzött ehhez:',
  internal_note_added: 'belső megjegyzést fűzött ehhez:',
  status_changed: 'megváltoztatta a státuszt:',
  priority_changed: 'megváltoztatta a prioritást:',
  assignee_changed: 'megváltoztatta a felelőst:',
  category_changed: 'megváltoztatta a kategóriát:',
  nudge_sent: 'emlékeztetőt küldött ehhez:',
}

const AUDIT_LABELS: Record<string, { label: string; color: string }> = {
  login:           { label: 'Bejelentkezés',        color: 'bg-green-100 text-green-700' },
  profile_updated: { label: 'Profil módosítva',      color: 'bg-blue-100 text-blue-700' },
  role_changed:    { label: 'Szerepkör változás',    color: 'bg-purple-100 text-purple-700' },
  status_changed:  { label: 'Státusz változás',      color: 'bg-orange-100 text-orange-700' },
  user_invited:    { label: 'Felhasználó meghívva',  color: 'bg-indigo-100 text-indigo-700' },
  user_deleted:    { label: 'Felhasználó törölve',   color: 'bg-red-100 text-red-700' },
  private_task_created:   { label: 'Privát feladat létrehozva', color: 'bg-violet-100 text-violet-700' },
  private_task_updated:   { label: 'Privát feladat módosítva',  color: 'bg-violet-100 text-violet-700' },
  private_task_commented: { label: 'Privát feladat: megjegyzés', color: 'bg-violet-100 text-violet-700' },
}

function userName(u: { name: string | null; firstName?: string | null; nickname?: string | null; email: string } | null) {
  if (!u) return 'Törölt felhasználó'
  return u.nickname || u.firstName || u.name || u.email
}

export default function LogPage() {
  const router = useRouter()
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<{ id: string; name: string | null; email: string }[]>([])
  const [userId, setUserId] = useState('')
  const [kindFilter, setKindFilter] = useState<'all' | 'activity' | 'audit'>('all')

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.user?.role === 'ADMIN') {
        setAllowed(true)
        fetch('/api/users').then(r => r.json()).then(d => setUsers(d.users || []))
      } else {
        setAllowed(false)
        router.replace('/dashboard')
      }
    })
  }, [router])

  const load = useCallback(async () => {
    if (allowed !== true) return
    setLoading(true)
    const params = new URLSearchParams()
    if (userId) params.set('userId', userId)
    params.set('pageSize', '100')

    const merged: FeedItem[] = []
    if (kindFilter === 'all' || kindFilter === 'activity') {
      const d = await fetch(`/api/activities?${params}`).then(r => r.json())
      ;(d.activities || []).forEach((a: Activity) => merged.push({ kind: 'activity', createdAt: a.createdAt, data: a }))
    }
    if (kindFilter === 'all' || kindFilter === 'audit') {
      const d = await fetch(`/api/audit-logs?${params}`).then(r => r.json())
      ;(d.logs || []).forEach((a: AuditEntry) => merged.push({ kind: 'audit', createdAt: a.createdAt, data: a }))
    }
    merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    setItems(merged)
    setLoading(false)
  }, [allowed, userId, kindFilter])

  useEffect(() => { load() }, [load])

  // Auto-refresh
  useEffect(() => {
    if (allowed !== true) return
    const interval = setInterval(load, 20000)
    return () => clearInterval(interval)
  }, [allowed, load])

  if (allowed === null) return <div className="p-6 text-gray-400">Betöltés...</div>
  if (allowed === false) return null

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Napló</h1>
        <p className="text-gray-500 text-sm mt-0.5">Feladat-tevékenységek és rendszeresemények egy helyen</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4 flex gap-3 flex-wrap">
        <select value={userId} onChange={e => setUserId(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-indigo-400">
          <option value="">Minden felhasználó</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
        </select>
        <select value={kindFilter} onChange={e => setKindFilter(e.target.value as 'all' | 'activity' | 'audit')}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-indigo-400">
          <option value="all">Minden típus</option>
          <option value="activity">Feladat-tevékenységek</option>
          <option value="audit">Rendszeresemények</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <span className="text-sm text-gray-500">{items.length} bejegyzés</span>
        </div>
        {loading ? (
          <div className="py-12 text-center text-gray-400">Betöltés...</div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-gray-400">Nincs bejegyzés</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {items.map(item => item.kind === 'activity' ? (
              <div key={`a-${item.data.id}`} className="flex items-start gap-4 px-5 py-4">
                <Avatar name={item.data.user?.name ?? null} firstName={item.data.user?.firstName} nickname={item.data.user?.nickname} email={item.data.user?.email ?? ''} avatarUrl={item.data.user?.avatarUrl} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">{userName(item.data.user)}</span>{' '}
                    {ACTIVITY_LABELS[item.data.action] || item.data.action}{' '}
                    <Link href={`/tickets/${item.data.ticket.id}`} className="font-medium text-indigo-600 hover:underline">
                      {item.data.ticket.title}
                    </Link>
                    {item.data.oldValue && item.data.newValue && item.data.action.includes('changed') && (
                      <span className="text-gray-400"> ({item.data.oldValue} → {item.data.newValue})</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(item.data.createdAt)}</p>
                </div>
              </div>
            ) : (
              <div key={`u-${item.data.id}`} className="flex items-start gap-4 px-5 py-4">
                {item.data.user ? (
                  <Avatar name={item.data.user.name} firstName={item.data.user.firstName} nickname={item.data.user.nickname} email={item.data.user.email} avatarUrl={item.data.user.avatarUrl} />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 text-xs flex-shrink-0">?</div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900">{userName(item.data.user)}</span>
                    {(() => {
                      const meta = AUDIT_LABELS[item.data.action] || { label: item.data.action, color: 'bg-gray-100 text-gray-600' }
                      return <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${meta.color}`}>{meta.label}</span>
                    })()}
                    {item.data.detail && <span className="text-xs text-gray-500">{item.data.detail}</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <p className="text-xs text-gray-400">{formatDateTime(item.data.createdAt)}</p>
                    {item.data.ip && <p className="text-xs text-gray-300">{item.data.ip}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

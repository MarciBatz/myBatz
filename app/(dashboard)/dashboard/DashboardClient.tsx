'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import PriorityBadge from '@/components/PriorityBadge'
import StatusBadge from '@/components/StatusBadge'
import Avatar from '@/components/Avatar'
import { formatRelativeTime, formatDate, displayName, buildUniqueDisplayNames } from '@/lib/utils'
import RichTextEditor from '@/components/RichTextEditor'

const MAX_FILE_SIZE = 50 * 1024 * 1024

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
      if (file.size > MAX_FILE_SIZE) { setError(`"${file.name}" túl nagy (max 50 MB)`); continue }
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      if (res.ok) { const d = await res.json(); results.push({ fileUrl: d.url, fileName: d.fileName, fileSize: d.size, mimeType: file.type }) }
    }
    setUploading(false)
    if (results.length) { const updated = [...pending, ...results]; setPending(updated); onUploaded(updated) }
  }

  function remove(idx: number) {
    const updated = pending.filter((_, i) => i !== idx)
    setPending(updated); onUploaded(updated)
  }

  return (
    <div>
      {error && <p className="text-xs text-red-500 mb-1">{error}</p>}
      {pending.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {pending.map((f, i) => (
            <div key={i} className="flex items-center gap-1 bg-gray-100 rounded-lg px-2 py-1">
              <span className="text-xs text-gray-600 max-w-32 truncate">{f.fileName}</span>
              <button type="button" onClick={() => remove(i)} className="text-gray-400 hover:text-red-500 ml-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          ))}
        </div>
      )}
      <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-indigo-300 transition-colors disabled:opacity-50">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
        </svg>
        {uploading ? 'Feltöltés...' : 'Fájl csatolása (max 50 MB)'}
      </button>
      <input ref={inputRef} type="file" multiple className="hidden" onChange={e => e.target.files && handleFiles(e.target.files)} />
    </div>
  )
}

interface TodayData {
  shifts: { id: string; title: string; assignedTo: string | null; forSelf: boolean; sheetTab: string }[]
  officeWeek: { assignedUser: { id: string; name: string | null; firstName: string | null; nickname: string | null } | null } | null
  events: { id: string; title: string; createdBy: { name: string | null; firstName: string | null; nickname: string | null } }[]
  vacations: { id: string; note: string | null; user: { id: string; name: string | null; firstName: string | null; nickname: string | null } }[]
}

interface Stats { open: number; inProgress: number; awaiting: number; closed: number }
interface Ticket {
  id: string; title: string; description: string; status: string; priority: string
  createdAt: string; updatedAt: string; pinned: boolean
  category?: { id: string; name: string } | null
  assignee?: { id: string; name: string | null; firstName?: string | null; nickname?: string | null; email: string; avatarUrl?: string | null } | null
  createdBy: { id: string; name: string | null; firstName?: string | null; nickname?: string | null; email: string; avatarUrl?: string | null }
  _count: { comments: number }
}
interface User { id: string; name: string | null; lastName?: string | null; firstName?: string | null; nickname?: string | null; email: string; role: string }

const STATUS_OPTIONS = ['', 'OPEN', 'IN_PROGRESS', 'AWAITING', 'CLOSED']
const PRIORITY_OPTIONS = ['', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW']

export default function DashboardClient({ user, ticketsOnly = false }: { user: User; ticketsOnly?: boolean }) {
  const [todayData, setTodayData] = useState<TodayData | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [agents, setAgents] = useState<{ id: string; name: string | null; email: string }[]>([])

  // Filters
  const [showClosed, setShowClosed] = useState(false)
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  // Create ticket modal
  const [showCreate, setShowCreate] = useState(false)

  // Nudge confirm
  const [nudgeTarget, setNudgeTarget] = useState<{ ticketId: string; ticketTitle: string; assigneeName: string } | null>(null)
  const [nudging, setNudging] = useState(false)

  async function togglePin(ticketId: string, current: boolean) {
    await fetch(`/api/tickets/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinned: !current }),
    })
    loadTickets()
  }

  async function sendNudge() {
    if (!nudgeTarget) return
    setNudging(true)
    const res = await fetch(`/api/tickets/${nudgeTarget.ticketId}/nudge`, { method: 'POST' })
    setNudging(false)
    setNudgeTarget(null)
    if (!res.ok) {
      const d = await res.json()
      alert(d.error || 'Hiba történt')
    }
  }

  useEffect(() => {
    fetch('/api/dashboard/stats').then(r => r.json()).then(d => setStats(d))
    fetch('/api/categories').then(r => r.json()).then(d => setCategories(d.categories || []))
    fetch('/api/users').then(r => r.json()).then(d => setAgents(d.users || []))
    fetch('/api/calendar/today').then(r => r.json()).then(d => setTodayData(d))
  }, [])

  const agentNameMap = buildUniqueDisplayNames(agents)

  const loadTickets = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    if (priority) params.set('priority', priority)
    if (categoryId) params.set('categoryId', categoryId)
    if (assigneeId) params.set('assigneeId', assigneeId)
    if (search) params.set('search', search)
    if (!showClosed) params.set('excludeClosed', 'true')
    params.set('page', String(page))
    params.set('pageSize', '20')

    const r = await fetch(`/api/tickets?${params}`)
    const d = await r.json()
    setTickets(d.tickets || [])
    setTotal(d.total || 0)
    setLoading(false)
  }, [status, priority, categoryId, assigneeId, search, page, showClosed])

  useEffect(() => { loadTickets() }, [loadTickets])

  function clearFilters() {
    setStatus(''); setPriority(''); setCategoryId(''); setAssigneeId(''); setSearch(''); setShowClosed(false); setPage(1)
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {ticketsOnly ? 'Ticketek' : `Szia, ${displayName(user)}!`}
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">{ticketsOnly ? 'Az összes hibajegy áttekintése' : 'Íme, mi történik ma'}</p>
        </div>
        {user.role !== 'READER' && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-xl"
            style={{ background: '#6C5CE7' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Új ticket
          </button>
        )}
      </div>

      {/* Today's calendar strip */}
      {!ticketsOnly && todayData && (() => {
        const chips: { key: string; label: string; color: string; bg: string }[] = []

        todayData.shifts.forEach(s => {
          const who = s.assignedTo ? ` · ${s.assignedTo}` : ''
          chips.push({
            key: s.id,
            label: `${s.title}${who}`,
            color: s.forSelf ? '#dc2626' : '#7c3aed',
            bg: s.forSelf ? '#fef2f2' : '#f5f3ff',
          })
        })

        if (todayData.officeWeek?.assignedUser) {
          const u = todayData.officeWeek.assignedUser
          const name = u.nickname || u.firstName || u.name || '?'
          chips.push({ key: 'office', label: `🧹 Irodai hetes: ${name}`, color: '#92400e', bg: '#fffbeb' })
        }

        todayData.vacations.forEach(v => {
          const u = v.user
          const name = u.nickname || u.firstName || u.name || '?'
          chips.push({ key: v.id, label: `🏖 Szabadság: ${name}`, color: '#0369a1', bg: '#f0f9ff' })
        })

        todayData.events.forEach(e => {
          chips.push({ key: e.id, label: e.title, color: '#0f766e', bg: '#f0fdfa' })
        })

        if (chips.length === 0) return null

        return (
          <div className="mb-5 flex flex-wrap gap-2 items-center">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-1">Ma</span>
            {chips.map(chip => (
              <span key={chip.key}
                className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium"
                style={{ color: chip.color, background: chip.bg }}>
                {chip.label}
              </span>
            ))}
          </div>
        )
      })()}

      {/* Stat cards */}
      {!ticketsOnly && <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Nyitott', value: stats?.open ?? '—', color: '#3B82F6', bg: '#EFF6FF' },
          { label: 'Folyamatban', value: stats?.inProgress ?? '—', color: '#6C5CE7', bg: '#EDE9FE' },
          { label: 'Várakozó', value: stats?.awaiting ?? '—', color: '#F59E0B', bg: '#FFFBEB' },
          { label: 'Lezárt', value: stats?.closed ?? '—', color: '#6B7280', bg: '#F9FAFB' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-600">{s.label}</span>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: s.bg }}>
                <div className="w-3 h-3 rounded-full" style={{ background: s.color }} />
              </div>
            </div>
            <p className="text-3xl font-bold" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Keresés a ticketek között..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="flex-1 min-w-48 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400"
          />
          <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400 bg-white">
            <option value="">Minden státusz</option>
            {STATUS_OPTIONS.filter(Boolean).map(s => <option key={s} value={s}>{{'OPEN':'Nyitott','IN_PROGRESS':'Folyamatban','AWAITING':'Várakozó','CLOSED':'Lezárt'}[s] ?? s}</option>)}
          </select>
          <select value={priority} onChange={e => { setPriority(e.target.value); setPage(1) }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400 bg-white">
            <option value="">Minden prioritás</option>
            {PRIORITY_OPTIONS.filter(Boolean).map(p => <option key={p} value={p}>{{'CRITICAL':'Kritikus','HIGH':'Magas','MEDIUM':'Közepes','LOW':'Alacsony'}[p] ?? p}</option>)}
          </select>
          <select value={categoryId} onChange={e => { setCategoryId(e.target.value); setPage(1) }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400 bg-white">
            <option value="">Minden kategória</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={assigneeId} onChange={e => { setAssigneeId(e.target.value); setPage(1) }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400 bg-white">
            <option value="">Minden felelős</option>
            {agents.map(a => <option key={a.id} value={a.id}>{agentNameMap[a.id] || a.email}</option>)}
          </select>
          <button
            onClick={() => { setShowClosed(v => !v); setPage(1) }}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-colors ${showClosed ? 'bg-gray-100 text-gray-700 border-gray-300' : 'text-gray-400 border-gray-200 hover:bg-gray-50 hover:text-gray-600'}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Lezárt feladatok
          </button>
          <button onClick={clearFilters} className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50">
            Szűrők törlése
          </button>
        </div>
      </div>

      {/* Ticket list */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">{total} ticket</span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-400">Betöltés...</div>
        ) : tickets.length === 0 ? (
          <div className="py-12 text-center text-gray-400">Nincs találat</div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-gray-400 uppercase tracking-wider border-b border-gray-50">
                    <th className="px-5 py-3 font-medium">Ticket</th>
                    <th className="px-4 py-3 font-medium">Kategória</th>
                    <th className="px-4 py-3 font-medium">Státusz</th>
                    <th className="px-4 py-3 font-medium">Prioritás</th>
                    <th className="px-4 py-3 font-medium">Felelős</th>
                    <th className="px-4 py-3 font-medium">Frissítve</th>
                    {user.role !== 'READER' && <th className="px-3 py-3 font-medium"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {tickets.map(ticket => (
                    <tr key={ticket.id} className={`transition-colors ${ticket.pinned ? 'bg-amber-50 hover:bg-amber-100/60 border-l-4 border-l-amber-400' : 'hover:bg-gray-50/50'}`}>
                      <td className="px-5 py-4">
                        <Link href={`/tickets/${ticket.id}`} className="group">
                          <div className="flex items-start gap-3">
                            <Avatar name={ticket.createdBy.name} firstName={ticket.createdBy.firstName} nickname={ticket.createdBy.nickname} email={ticket.createdBy.email} avatarUrl={ticket.createdBy.avatarUrl} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                {ticket.pinned && <span className="text-amber-500 text-xs font-semibold">★ Kiemelt</span>}
                                <p className="text-sm font-medium text-gray-900 group-hover:text-indigo-600 truncate max-w-xs">{ticket.title}</p>
                              </div>
                              <p className="text-xs text-gray-400 truncate max-w-xs mt-0.5">{ticket.description.replace(/<[^>]+>/g, '').slice(0, 80)}...</p>
                            </div>
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-4">
                        {ticket.category ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-purple-50 text-purple-700">
                            {ticket.category.name}
                          </span>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-4"><StatusBadge status={ticket.status} /></td>
                      <td className="px-4 py-4"><PriorityBadge priority={ticket.priority} /></td>
                      <td className="px-4 py-4">
                        {ticket.assignee ? (
                          <div className="flex items-center gap-2">
                            <Avatar name={ticket.assignee.name} firstName={ticket.assignee.firstName} nickname={ticket.assignee.nickname} email={ticket.assignee.email} avatarUrl={ticket.assignee.avatarUrl} />
                            <span className="text-xs text-gray-600 truncate max-w-24">{agentNameMap[ticket.assignee.id] || displayName(ticket.assignee) || ticket.assignee.email}</span>
                          </div>
                        ) : <span className="text-gray-300 text-xs">Nincs hozzárendelve</span>}
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-xs text-gray-400">{formatRelativeTime(ticket.updatedAt)}</span>
                      </td>
                      {user.role !== 'READER' && (
                        <td className="px-3 py-4">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => togglePin(ticket.id, ticket.pinned)}
                              title={ticket.pinned ? 'Kiemelés eltávolítása' : 'Kiemelés'}
                              className={`p-1.5 rounded-lg transition-colors ${ticket.pinned ? 'text-amber-500 hover:bg-amber-100' : 'text-gray-300 hover:text-amber-400 hover:bg-amber-50'}`}>
                              <svg className="w-4 h-4" fill={ticket.pinned ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                              </svg>
                            </button>
                            {ticket.assignee && ticket.assignee.id !== user.id && (
                              <button
                                onClick={() => { const a = ticket.assignee!; setNudgeTarget({ ticketId: ticket.id, ticketTitle: ticket.title, assigneeName: agentNameMap[a.id] || displayName(a) || a.email }) }}
                                title="Emlékeztető küldése a felelősnek"
                                className="p-1.5 rounded-lg text-gray-300 hover:text-indigo-500 hover:bg-indigo-50 transition-colors">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-gray-100">
              {tickets.map(ticket => (
                <Link key={ticket.id} href={`/tickets/${ticket.id}`} className="block p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-sm font-medium text-gray-900 flex-1">{ticket.title}</p>
                    <PriorityBadge priority={ticket.priority} />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={ticket.status} />
                    {ticket.category && (
                      <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-md">{ticket.category.name}</span>
                    )}
                    <span className="text-xs text-gray-400 ml-auto">{formatRelativeTime(ticket.updatedAt)}</span>
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {total > 20 && (
              <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-400">{page}. oldal / {Math.ceil(total / 20)}</span>
                <div className="flex gap-2">
                  <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                    className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">
                    Előző
                  </button>
                  <button disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)}
                    className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">
                    Következő
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Nudge confirm modal */}
      {nudgeTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Emlékeztető küldése</h3>
            </div>
            <p className="text-gray-600 text-sm mb-6">
              Szeretnéd emlékeztetni <strong>{nudgeTarget.assigneeName}</strong> felhasználót, hogy foglalkozzon ezzel a feladattal?
              <br /><span className="text-gray-400 mt-1 block">„{nudgeTarget.ticketTitle}"</span>
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setNudgeTarget(null)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">Mégse</button>
              <button onClick={sendNudge} disabled={nudging}
                className="px-4 py-2 text-sm text-white font-medium rounded-xl disabled:opacity-60"
                style={{ background: '#6C5CE7' }}>
                {nudging ? 'Küldés...' : 'Emlékeztető küldése'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create ticket modal */}
      {showCreate && (
        <CreateTicketModal
          categories={categories}
          agents={agents}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); loadTickets(); fetch('/api/dashboard/stats').then(r => r.json()).then(d => setStats(d)) }}
        />
      )}
    </div>
  )
}

function CreateTicketModal({
  categories,
  agents,
  onClose,
  onCreated,
}: {
  categories: { id: string; name: string }[]
  agents: { id: string; name: string | null; email: string }[]
  onClose: () => void
  onCreated: () => void
}) {
  const modalAgentNameMap = buildUniqueDisplayNames(agents)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('MEDIUM')
  const [categoryId, setCategoryId] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [attachments, setAttachments] = useState<{ fileUrl: string; fileName: string; fileSize: number; mimeType: string }[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!description || description === '<p></p>') { setError('A leírás megadása kötelező'); setLoading(false); return }
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, priority, categoryId: categoryId || null, assigneeId: assigneeId || null, attachments }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to create ticket'); return }
      onCreated()
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">Új ticket</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Cím</label>
            <input type="text" required value={title} onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400"
              placeholder="A probléma rövid leírása" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Leírás</label>
            <RichTextEditor value={description} onChange={(html) => setDescription(html)} placeholder="Részletes leírás..." minHeight="120px" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Prioritás</label>
              <select value={priority} onChange={e => setPriority(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400 bg-white">
                <option value="LOW">Alacsony</option>
                <option value="MEDIUM">Közepes</option>
                <option value="HIGH">Magas</option>
                <option value="CRITICAL">Kritikus</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Kategória</label>
              <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400 bg-white">
                <option value="">Nincs</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Felelős</label>
            <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400 bg-white">
              <option value="">Nincs hozzárendelve</option>
              {agents.map(a => <option key={a.id} value={a.id}>{modalAgentNameMap[a.id] || a.email}</option>)}
            </select>
          </div>
          <div>
            <FileUploader onUploaded={setAttachments} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">Mégse</button>
            <button type="submit" disabled={loading} className="px-4 py-2 text-sm text-white font-medium rounded-xl disabled:opacity-60" style={{ background: '#6C5CE7' }}>
              {loading ? 'Létrehozás...' : 'Ticket létrehozása'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

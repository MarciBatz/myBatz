'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import PriorityBadge from '@/components/PriorityBadge'
import StatusBadge from '@/components/StatusBadge'
import Avatar from '@/components/Avatar'
import { formatRelativeTime, formatDate, displayName, fullDisplayName, buildUniqueDisplayNames } from '@/lib/utils'
import RichTextEditor, { type RichTextEditorHandle } from '@/components/RichTextEditor'
import FileUpload, { type UploadedFile } from '@/components/FileUpload'
import DepartmentBadge from '@/components/DepartmentBadge'
import DepartmentFilterBar, { type SelectableDepartment } from '@/components/DepartmentFilterBar'
import { COMPANY_WIDE, COMPANY_WIDE_LABEL, COMPANY_WIDE_COLOR } from '@/lib/departments'
import { useVisibleInterval } from '@/lib/use-visible-interval'

interface TodayData {
  shifts: { id: string; shopName: string | null; location: string | null; assignedTo: string | null; forSelf: boolean; sheetTab: string }[]
  officeWeek: { assignedUser: { id: string; name: string | null; firstName: string | null; lastName: string | null; nickname: string | null } | null } | null
  events: { id: string; title: string; createdBy: { name: string | null; firstName: string | null; lastName: string | null; nickname: string | null } }[]
  vacations: { id: string; note: string | null; user: { id: string; name: string | null; firstName: string | null; lastName: string | null; nickname: string | null } }[]
}

interface Stats { open: number; inProgress: number; awaiting: number; closed: number }
interface Ticket {
  id: string; title: string; description: string; status: string; priority: string
  createdAt: string; updatedAt: string; pinned: boolean
  visibility: string
  department?: { id: string; name: string; color: string } | null
  category?: { id: string; name: string } | null
  assignee?: { id: string; name: string | null; firstName?: string | null; lastName?: string | null; nickname?: string | null; email: string; avatarUrl?: string | null } | null
  createdBy: { id: string; name: string | null; firstName?: string | null; lastName?: string | null; nickname?: string | null; email: string; avatarUrl?: string | null }
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
  const [categories, setCategories] = useState<{ id: string; name: string; department?: { name: string } }[]>([])
  const [agents, setAgents] = useState<{ id: string; name: string | null; firstName?: string | null; lastName?: string | null; nickname?: string | null; email: string }[]>([])

  // Filters
  const [showClosed, setShowClosed] = useState(true)
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  // Department scope. Empty array = "all departments I have access to".
  const [departments, setDepartments] = useState<SelectableDepartment[]>([])
  const [departmentIds, setDepartmentIds] = useState<string[]>([])
  // Department ids that existed when the saved selection was last written, so
  // ones created since can be recognised as new (see effectiveDepartmentIds).
  const [knownDepartmentIds, setKnownDepartmentIds] = useState<string[]>([])
  const departmentsLoaded = useRef(false)
  // Only the fetched permission is stored; the ADMIN shortcut is derived below,
  // so nothing is set synchronously inside an effect.
  const [companyWidePermission, setCompanyWidePermission] = useState(false)
  const canCompanyWide = user.role === 'ADMIN' || companyWidePermission

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
    fetch('/api/categories').then(r => r.json()).then(d => setCategories(d.categories || []))
    fetch('/api/users').then(r => r.json()).then(d => setAgents(d.users || []))
    fetch('/api/calendar/today').then(r => r.json()).then(d => setTodayData(d))
    fetch('/api/departments').then(r => r.json())
      .then(d => setDepartments(d.departments || []))
      .catch(() => {})
      .finally(() => { departmentsLoaded.current = true })
    // Company-wide creation is a per-user permission; ADMIN is handled by the
    // derived flag above, so only non-admins need the lookup.
    if (user.role !== 'ADMIN') {
      fetch(`/api/users/${user.id}/settings`).then(r => r.json())
        .then(s => setCompanyWidePermission(s.permissions?.canCreateCompanyWideTasks === true))
        .catch(() => {})
    }
  }, [user.id, user.role])

  // A department the user lost access to must not affect the view. Derived
  // rather than written back into state, so a stale saved id simply has no
  // effect instead of triggering a render loop. (The server also strips removed
  // ids from the saved filter when an admin revokes access.)
  //
  // Departments that appeared *after* the saved selection was made are added to
  // it. Without this, someone who once narrowed the filter would silently never
  // see a new department's tickets — including ones assigned to them. An empty
  // selection already means "all", so this only matters for explicit subsets.
  //
  // Memoised on the *contents*, not the array identity: this value is an effect
  // dependency, and a fresh array each render would re-trigger the ticket fetch
  // on every render.
  const departmentIdsKey = departmentIds.join(',')
  const departmentsKey = departments.map(d => d.id).join(',')
  const knownDepartmentIdsKey = knownDepartmentIds.join(',')
  const effectiveDepartmentIds = useMemo(() => {
    const available = departmentsKey ? departmentsKey.split(',') : []
    const selected = departmentIdsKey.split(',').filter(Boolean)
    if (selected.length === 0) return []
    if (available.length === 0) return selected

    const known = new Set(knownDepartmentIdsKey.split(',').filter(Boolean))
    const kept = selected.filter(d => available.includes(d))
    // Only treat departments as new when we actually recorded a "known" set;
    // an older saved filter without one must not select everything at once.
    const added = known.size > 0 ? available.filter(d => !known.has(d)) : []
    return [...new Set([...kept, ...added])]
  }, [departmentIdsKey, departmentsKey, knownDepartmentIdsKey])

  const agentNameMap = buildUniqueDisplayNames(agents)

  const filtersReady = useRef(false)

  // The counters ride along with the list rather than being a second request:
  // they share the department scope anyway, so asking for both at once halves
  // the traffic without changing what's displayed.
  const loadTickets = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    if (priority) params.set('priority', priority)
    if (categoryId) params.set('categoryId', categoryId)
    if (assigneeId) params.set('assigneeId', assigneeId)
    if (search) params.set('search', search)
    if (!showClosed) params.set('excludeClosed', 'true')
    for (const d of effectiveDepartmentIds) params.append('departmentIds', d)
    params.set('page', String(page))
    params.set('pageSize', '20')
    if (!ticketsOnly) params.set('withStats', 'true')

    const r = await fetch(`/api/tickets?${params}`)
    const d = await r.json()
    setTickets(d.tickets || [])
    setTotal(d.total || 0)
    if (d.stats) setStats(d.stats)
    setLoading(false)
  }, [status, priority, categoryId, assigneeId, search, page, showClosed, effectiveDepartmentIds, ticketsOnly])

  useEffect(() => { loadTickets() }, [loadTickets])

  // Restore saved filters from the user's account on mount
  useEffect(() => {
    fetch('/api/ticket-filters')
      .then(r => r.json())
      .then(d => {
        const f = d.filters
        if (f) {
          if (typeof f.status === 'string') setStatus(f.status)
          if (typeof f.priority === 'string') setPriority(f.priority)
          if (typeof f.categoryId === 'string') setCategoryId(f.categoryId)
          if (typeof f.assigneeId === 'string') setAssigneeId(f.assigneeId)
          if (typeof f.search === 'string') setSearch(f.search)
          if (typeof f.showClosed === 'boolean') setShowClosed(f.showClosed)
          if (Array.isArray(f.departmentIds)) {
            setDepartmentIds(f.departmentIds.filter((d: unknown) => typeof d === 'string'))
          }
          if (Array.isArray(f.knownDepartmentIds)) {
            setKnownDepartmentIds(f.knownDepartmentIds.filter((d: unknown) => typeof d === 'string'))
          }
        }
      })
      .catch(() => {})
      .finally(() => { filtersReady.current = true })
  }, [])

  // Persist filters to the user's account whenever they change (debounced).
  // Saves the *effective* department selection, so departments added by the rule
  // above (and ones the user lost access to) are recorded rather than recomputed
  // on every visit. Waits for the department list: persisting an empty "known"
  // set would make every existing department look new on the next load.
  const effectiveDepartmentIdsKey = effectiveDepartmentIds.join(',')
  useEffect(() => {
    if (!filtersReady.current || !departmentsLoaded.current) return
    const t = setTimeout(() => {
      fetch('/api/ticket-filters', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filters: {
            status, priority, categoryId, assigneeId, search, showClosed,
            departmentIds: effectiveDepartmentIdsKey.split(',').filter(Boolean),
            knownDepartmentIds: departmentsKey.split(',').filter(Boolean),
          },
        }),
      }).catch(() => {})
    }, 600)
    return () => clearTimeout(t)
  }, [status, priority, categoryId, assigneeId, search, showClosed, effectiveDepartmentIdsKey, departmentsKey])

  // Auto-refresh so new tickets/updates appear without a manual reload. Only
  // while the tab is actually being looked at, and once a minute rather than
  // three times — this list is the single most-requested endpoint we have.
  // No useCallback needed: the hook keeps the callback in a ref, so a fresh
  // closure each render doesn't restart the timer.
  useVisibleInterval(() => loadTickets(true), 60000)

  function clearFilters() {
    setStatus(''); setPriority(''); setCategoryId(''); setAssigneeId(''); setSearch(''); setShowClosed(false); setPage(1); setDepartmentIds([])
    fetch('/api/ticket-filters', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filters: null }),
    }).catch(() => {})
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {ticketsOnly ? 'Feladatok' : `Szia, ${displayName(user)}!`}
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">{ticketsOnly ? 'Az összes feladat áttekintése' : 'Íme, mi történik ma'}</p>
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
            Új feladat
          </button>
        )}
      </div>

      {/* Today's calendar strip */}
      {!ticketsOnly && todayData && (() => {
        const chips: { key: string; label: string; color: string; bg: string }[] = []

        todayData.shifts.forEach(s => {
          const shopLabel = s.shopName || s.location || 'Szűrőnap'
          const who = s.assignedTo ? ` · ${s.assignedTo}` : ''
          chips.push({
            key: s.id,
            label: `${shopLabel}${who}`,
            color: s.forSelf ? '#dc2626' : '#7c3aed',
            bg: s.forSelf ? '#fef2f2' : '#f5f3ff',
          })
        })

        if (todayData.officeWeek?.assignedUser) {
          const u = todayData.officeWeek.assignedUser
          const name = fullDisplayName(u) || '?'
          chips.push({ key: 'office', label: `🧹 Irodai hetes: ${name}`, color: '#92400e', bg: '#fffbeb' })
        }

        todayData.vacations.forEach(v => {
          const u = v.user
          const name = fullDisplayName(u) || '?'
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

      {/* Department scope */}
      <DepartmentFilterBar
        departments={departments}
        selectedIds={effectiveDepartmentIds}
        onChange={ids => { setDepartmentIds(ids); setPage(1) }}
      />

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
          <select value={categoryId} onChange={e => { setCategoryId(e.target.value); setPage(1) }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400 bg-white">
            <option value="">Minden kategória</option>
            {/* Two departments may each have an "Egyéb", so the department is
                appended only where the bare name would be ambiguous. */}
            {categories.map(c => {
              const ambiguous = categories.filter(o => o.name === c.name).length > 1
              return (
                <option key={c.id} value={c.id}>
                  {ambiguous && c.department ? `${c.name} (${c.department.name})` : c.name}
                </option>
              )
            })}
          </select>
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
          <span className="text-sm font-medium text-gray-700">{total} feladat</span>
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
                    <th className="px-5 py-3 font-medium">Feladat</th>
                    <th className="px-4 py-3 font-medium">Részleg</th>
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
                            <Avatar name={ticket.createdBy.name} firstName={ticket.createdBy.firstName} lastName={ticket.createdBy.lastName} nickname={ticket.createdBy.nickname} email={ticket.createdBy.email} avatarUrl={ticket.createdBy.avatarUrl} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                {ticket.pinned && (
                                  <span className="shrink-0 whitespace-nowrap text-amber-500 text-xs font-semibold">★ Kiemelt</span>
                                )}
                                {/* min-w-0 is required here: a flex item with nowrap text otherwise
                                    refuses to shrink below its full (untruncated) width, which pushed
                                    against the "Kiemelt" badge and wrapped its text instead. */}
                                <p className="min-w-0 text-sm font-medium text-gray-900 group-hover:text-indigo-600 truncate max-w-xs">{ticket.title}</p>
                              </div>
                              <p className="text-xs text-gray-400 truncate max-w-xs mt-0.5">{ticket.description.replace(/<[^>]+>/g, '').slice(0, 80)}...</p>
                            </div>
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-4">
                        <DepartmentBadge visibility={ticket.visibility} department={ticket.department} />
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
                            <Avatar name={ticket.assignee.name} firstName={ticket.assignee.firstName} lastName={ticket.assignee.lastName} nickname={ticket.assignee.nickname} email={ticket.assignee.email} avatarUrl={ticket.assignee.avatarUrl} />
                            <span className="text-xs text-gray-600 truncate max-w-24">{agentNameMap[ticket.assignee.id] || fullDisplayName(ticket.assignee) || ticket.assignee.email}</span>
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
                                onClick={() => { const a = ticket.assignee!; setNudgeTarget({ ticketId: ticket.id, ticketTitle: ticket.title, assigneeName: agentNameMap[a.id] || fullDisplayName(a) || a.email }) }}
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
                <Link key={ticket.id} href={`/tickets/${ticket.id}`}
                  className={`block p-4 transition-colors ${ticket.pinned ? 'bg-amber-50 hover:bg-amber-100/60 border-l-4 border-l-amber-400' : 'hover:bg-gray-50'}`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      {ticket.pinned && (
                        <span className="block shrink-0 whitespace-nowrap text-amber-500 text-xs font-semibold mb-0.5">★ Kiemelt</span>
                      )}
                      <p className="text-sm font-medium text-gray-900">{ticket.title}</p>
                    </div>
                    <PriorityBadge priority={ticket.priority} />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <DepartmentBadge visibility={ticket.visibility} department={ticket.department} size="xs" />
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
          agents={agents}
          departments={departments}
          canCompanyWide={canCompanyWide}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); loadTickets() }}
        />
      )}
    </div>
  )
}

function CreateTicketModal({
  agents,
  departments,
  canCompanyWide,
  onClose,
  onCreated,
}: {
  agents: { id: string; name: string | null; email: string }[]
  departments: SelectableDepartment[]
  canCompanyWide: boolean
  onClose: () => void
  onCreated: () => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('MEDIUM')
  const [categoryId, setCategoryId] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [attachments, setAttachments] = useState<UploadedFile[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Target: exactly one department, or company-wide. A single-department user
  // never has to choose; anyone with several must pick deliberately (no
  // pre-selected default that could file a ticket in the wrong place).
  const [target, setTarget] = useState<string>(departments.length === 1 ? departments[0].id : '')
  const companyWide = target === COMPANY_WIDE
  const [confirmCompanyWide, setConfirmCompanyWide] = useState(false)

  // Assignee candidates for the chosen target, so you can't hand a department
  // ticket to someone outside it. Only the fetched result is stored; the list
  // actually shown is derived, which keeps this out of an effect-sync loop.
  const [fetchedEligible, setFetchedEligible] = useState<{ id: string; name: string | null; firstName?: string | null; lastName?: string | null; nickname?: string | null; email: string }[] | null>(null)
  useEffect(() => {
    if (!target) return
    const q = companyWide
      ? `forVisibility=${COMPANY_WIDE}`
      : `forDepartmentId=${encodeURIComponent(target)}`
    let cancelled = false
    fetch(`/api/users?${q}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) setFetchedEligible(d.users || []) })
      .catch(() => { if (!cancelled) setFetchedEligible([]) })
    // A fast target switch must not let a stale response overwrite the new list.
    return () => { cancelled = true }
  }, [target, companyWide])

  // Categories belong to one department, so the list follows the chosen target.
  // A company-wide ticket gets none — a department's category says nothing about
  // a ticket that spans the whole company.
  const [fetchedCategories, setFetchedCategories] = useState<{ id: string; name: string }[] | null>(null)
  useEffect(() => {
    if (!target || companyWide) return
    let cancelled = false
    fetch(`/api/categories?forDepartmentId=${encodeURIComponent(target)}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) setFetchedCategories(d.categories || []) })
      .catch(() => { if (!cancelled) setFetchedCategories([]) })
    return () => { cancelled = true }
  }, [target, companyWide])

  const eligible = target ? (fetchedEligible ?? []) : agents

  // Derived, not synced: if the picked assignee isn't in the current target's
  // list, treat the field as empty and say why. The server re-checks anyway.
  const assigneeStillEligible = !assigneeId || eligible.length === 0 || eligible.some(u => u.id === assigneeId)
  const effectiveAssigneeId = assigneeStillEligible ? assigneeId : ''

  // Same derivation for the category: one left over from a previous department
  // simply doesn't apply any more. Empty until a department is picked — there is
  // no meaningful list before that, and the field is disabled anyway.
  const availableCategories = (!target || companyWide) ? [] : (fetchedCategories ?? [])
  const categoryStillValid = !categoryId || availableCategories.some(c => c.id === categoryId)
  const effectiveCategoryId = categoryStillValid ? categoryId : ''

  const modalAgentNameMap = buildUniqueDisplayNames(eligible)

  // Drafts
  const editorRef = useRef<RichTextEditorHandle>(null)
  const [draftId, setDraftId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<{ id: string; title: string; description: string; priority: string; categoryId: string | null; assigneeId: string | null; updatedAt: string }[]>([])
  const [showDrafts, setShowDrafts] = useState(false)
  const draftReady = useRef(false)
  const submittedRef = useRef(false)
  const creatingRef = useRef(false)
  // Synchronous re-entry guard for the ticket POST (see createTicket).
  const creatingTicketRef = useRef(false)

  const loadDrafts = useCallback(async () => {
    const r = await fetch('/api/ticket-drafts')
    const d = await r.json()
    setDrafts(d.drafts || [])
  }, [])

  useEffect(() => {
    loadDrafts().finally(() => { draftReady.current = true })
  }, [loadDrafts])

  // Continuously autosave the in-progress ticket to a draft (debounced)
  useEffect(() => {
    if (!draftReady.current) return
    if (submittedRef.current) return
    const hasContent = title.trim() !== '' || (description !== '' && description !== '<p></p>')
    if (!hasContent) return

    const t = setTimeout(async () => {
      const payload = { title, description, priority, categoryId: categoryId || null, assigneeId: assigneeId || null }
      if (draftId) {
        await fetch(`/api/ticket-drafts/${draftId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).catch(() => {})
      } else if (!creatingRef.current) {
        creatingRef.current = true
        const r = await fetch('/api/ticket-drafts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        const d = await r.json().catch(() => ({}))
        if (d.draft?.id) setDraftId(d.draft.id)
        creatingRef.current = false
      }
    }, 1000)
    return () => clearTimeout(t)
  }, [title, description, priority, categoryId, assigneeId, draftId])

  function loadDraft(dr: { id: string; title: string; description: string; priority: string; categoryId: string | null; assigneeId: string | null }) {
    setTitle(dr.title || '')
    setDescription(dr.description || '')
    editorRef.current?.setContent(dr.description || '')
    setPriority(dr.priority || 'MEDIUM')
    setCategoryId(dr.categoryId || '')
    setAssigneeId(dr.assigneeId || '')
    setDraftId(dr.id)
    setShowDrafts(false)
  }

  async function deleteDraft(id: string) {
    await fetch(`/api/ticket-drafts/${id}`, { method: 'DELETE' }).catch(() => {})
    if (id === draftId) setDraftId(null)
    loadDrafts()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!description || description === '<p></p>') { setError('A leírás megadása kötelező'); return }
    if (!target) { setError('Válaszd ki, melyik részleghez tartozik a feladat.'); return }
    if (!effectiveAssigneeId) { setError('Válassz felelőst — minden feladatnak kell felelőse.'); return }
    // Company-wide needs an explicit second confirmation; the form state is kept
    // intact behind the dialog so "Visszalépek" loses nothing.
    if (companyWide) { setConfirmCompanyWide(true); return }
    void createTicket()
  }

  async function createTicket() {
    // Guard with a ref, not `loading`: setState is asynchronous, so several
    // clicks landing in the same tick would all read loading === false (and the
    // button's disabled attribute wouldn't be applied yet either) and each fire
    // its own POST. A ref flips synchronously, so only the first gets through.
    if (creatingTicketRef.current || submittedRef.current) return
    creatingTicketRef.current = true
    setConfirmCompanyWide(false)
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, description, priority,
          categoryId: effectiveCategoryId || null,
          assigneeId: effectiveAssigneeId,
          visibility: companyWide ? COMPANY_WIDE : 'DEPARTMENT',
          departmentId: companyWide ? null : target,
          attachments,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to create feladat'); return }
      // Remove the draft once the ticket is created
      submittedRef.current = true
      if (draftId) await fetch(`/api/ticket-drafts/${draftId}`, { method: 'DELETE' }).catch(() => {})
      onCreated()
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
      // Released only on failure; a success closes the modal via onCreated().
      if (!submittedRef.current) creatingTicketRef.current = false
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">Új feladat</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowDrafts(true)}
              className="relative flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-600 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:border-indigo-300 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Piszkozatok
              {drafts.length > 0 && (
                <span className="ml-0.5 inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-semibold">{drafts.length}</span>
              )}
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>}
          {draftId && <p className="text-xs text-gray-400 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-400" /> Piszkozat automatikusan mentve</p>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Cím</label>
            <input type="text" required value={title} onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400"
              placeholder="A probléma rövid leírása" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Leírás</label>
            <RichTextEditor editorRef={editorRef} value={description} onChange={(html) => setDescription(html)} placeholder="Részletes leírás..." minHeight="120px" />
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
              <select value={effectiveCategoryId} onChange={e => setCategoryId(e.target.value)}
                disabled={!target || companyWide}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400 bg-white disabled:bg-gray-50 disabled:text-gray-400">
                <option value="">Nincs</option>
                {availableCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {companyWide ? (
                <p className="text-xs text-gray-400 mt-1.5">A kategóriák részlegenként külön állnak, ezért teljes céges feladathoz nem választható.</p>
              ) : !target ? (
                <p className="text-xs text-gray-400 mt-1.5">Először válaszd ki a részleget.</p>
              ) : !categoryStillValid ? (
                <p className="text-xs text-amber-600 mt-1.5">A korábbi kategória nem ehhez a részleghez tartozik, ezért nem lesz beállítva.</p>
              ) : availableCategories.length === 0 && fetchedCategories !== null ? (
                <p className="text-xs text-gray-400 mt-1.5">Ennek a részlegnek még nincs kategóriája.</p>
              ) : null}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Részleg</label>
            {departments.length === 0 && !canCompanyWide ? (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Nem tartozol egyetlen részleghez sem, ezért nem tudsz publikus feladatot létrehozni.
                Kérj hozzáférést egy adminisztrátortól.
              </p>
            ) : departments.length === 1 && !canCompanyWide ? (
              // One department and no company-wide right: nothing to choose, but
              // still show where the ticket will land.
              <div className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg bg-gray-50">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: departments[0].color }} />
                <span className="text-sm text-gray-700">{departments[0].name}</span>
                <span className="text-xs text-gray-400 ml-auto">ide kerül a feladat</span>
              </div>
            ) : (
              <select value={target} onChange={e => setTarget(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400 bg-white">
                <option value="">— Válassz részleget —</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                {canCompanyWide && <option disabled>──────────</option>}
                {canCompanyWide && <option value={COMPANY_WIDE}>🌐 {COMPANY_WIDE_LABEL}</option>}
              </select>
            )}
            {companyWide && (
              <div className="mt-2 flex items-start gap-2 px-3 py-2 rounded-lg border"
                style={{ background: '#F0FDFA', borderColor: COMPANY_WIDE_COLOR }}>
                <svg className="w-4 h-4 shrink-0 mt-0.5" style={{ color: COMPANY_WIDE_COLOR }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5.07 19h13.86a2 2 0 001.74-2.99l-6.93-12a2 2 0 00-3.48 0l-6.93 12A2 2 0 005.07 19z" />
                </svg>
                <p className="text-xs font-medium" style={{ color: COMPANY_WIDE_COLOR }}>
                  A feladatot a teljes cég minden felhasználója látni fogja.
                </p>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Felelős <span className="text-red-500">*</span>
            </label>
            <select value={effectiveAssigneeId} onChange={e => setAssigneeId(e.target.value)}
              disabled={!target}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400 bg-white disabled:bg-gray-50 disabled:text-gray-400">
              <option value="">— Válassz felelőst —</option>
              {eligible.map(a => <option key={a.id} value={a.id}>{modalAgentNameMap[a.id] || a.email}</option>)}
            </select>
            {!assigneeStillEligible && (
              <p className="text-xs text-amber-600 mt-1.5">
                A korábban kiválasztott felelős nem tartozik ehhez a részleghez. Válassz új felelőst.
              </p>
            )}
            {!target && (
              <p className="text-xs text-gray-400 mt-1.5">Először válaszd ki a részleget.</p>
            )}
            {target && eligible.length === 0 && fetchedEligible !== null && (
              <p className="text-xs text-amber-600 mt-1.5">
                Ehhez a részleghez nincs olyan felhasználó, akire rábízható a feladat.
              </p>
            )}
          </div>
          <div>
            <FileUpload value={attachments} onChange={setAttachments} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">Mégse</button>
            <button type="submit" disabled={loading || !target || !effectiveAssigneeId}
              className="px-4 py-2 text-sm text-white font-medium rounded-xl disabled:opacity-60" style={{ background: '#6C5CE7' }}>
              {loading ? 'Létrehozás...' : 'Feladat létrehozása'}
            </button>
          </div>
        </form>

        {/* Company-wide final confirmation. Rendered over the form, which keeps
            all its state, so "Visszalépek" loses nothing. */}
        {confirmCompanyWide && (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-black/40 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: '#CCFBF1' }}>
                  <svg className="w-5 h-5" style={{ color: COMPANY_WIDE_COLOR }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-gray-900">Teljes céges feladat</h3>
              </div>
              <p className="text-sm text-gray-600 mb-5">
                Biztosan az egész cég számára látható feladatot szeretnél létrehozni?
              </p>
              <div className="flex flex-col sm:flex-row justify-end gap-2">
                <button type="button" onClick={() => setConfirmCompanyWide(false)}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">
                  Visszalépek
                </button>
                <button type="button" onClick={() => void createTicket()} disabled={loading}
                  className="px-4 py-2 text-sm text-white font-medium rounded-xl disabled:opacity-60"
                  style={{ background: COMPANY_WIDE_COLOR }}>
                  {loading ? 'Létrehozás...' : 'Igen, létrehozom a teljes cégnek'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Drafts panel */}
        {showDrafts && (
          <div className="absolute inset-0 z-10 flex flex-col bg-white rounded-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <h2 className="text-lg font-semibold text-gray-900">Piszkozatok</h2>
              <button onClick={() => setShowDrafts(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 overflow-y-auto">
              {drafts.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Nincs mentett piszkozat</p>
              ) : (
                <div className="space-y-2">
                  {drafts.map(dr => (
                    <div key={dr.id} className={`flex items-start justify-between gap-3 p-3 rounded-xl border ${dr.id === draftId ? 'border-indigo-200 bg-indigo-50/50' : 'border-gray-100 hover:bg-gray-50'}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{dr.title || '(cím nélkül)'}</p>
                        <p className="text-xs text-gray-400 truncate mt-0.5">{(dr.description || '').replace(/<[^>]+>/g, '').slice(0, 60) || '(üres)'}</p>
                        <p className="text-[11px] text-gray-300 mt-1">Módosítva: {formatRelativeTime(dr.updatedAt)}</p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button type="button" onClick={() => loadDraft(dr)} className="text-xs text-indigo-500 hover:text-indigo-700 px-2 py-1 rounded border border-indigo-100 hover:border-indigo-200">Betöltés</button>
                        <button type="button" onClick={() => deleteDraft(dr.id)} className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded border border-red-50 hover:border-red-100">Törlés</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

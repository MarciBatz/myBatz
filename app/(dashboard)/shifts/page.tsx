'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { buildUniqueDisplayNames } from '@/lib/utils'

interface ShiftDay {
  id: string; date: string; timeStart: string | null; timeEnd: string | null
  location: string | null; shopName: string | null; address: string | null
  contactEmail: string | null; contactPhone: string | null; adMode: string | null
  assignedTo: string | null; forSelf: boolean; notes: string | null
  shopCode: string | null; syncedAt: string; strikethrough: boolean; bgColor: string | null
}
interface CalendarEvent {
  id: string; title: string; description: string | null; date: string; type: string
  createdBy: { firstName: string | null; name: string | null; nickname: string | null; email: string } | null
}
interface OfficeWeek {
  id: string; weekStart: string; isManual: boolean
  assignedUser: { id: string; name: string | null; firstName: string | null; lastName: string | null; nickname: string | null; email: string } | null
}
interface SimpleUser { id: string; name: string | null; firstName: string | null; lastName: string | null; nickname: string | null }
interface Vacation {
  id: string; startDate: string; endDate: string; note: string | null
  user: { id: string; name: string | null; firstName: string | null; nickname: string | null; email: string }
}

type DayItem =
  | { kind: 'shift'; data: ShiftDay }
  | { kind: 'event'; data: CalendarEvent }
  | { kind: 'office'; data: OfficeWeek }
  | { kind: 'vacation'; data: Vacation }

type FilterKey = 'szuronap' | 'irodai' | 'egyeb' | 'szabadsag'
const ALL_FILTERS: FilterKey[] = ['szuronap', 'irodai', 'egyeb', 'szabadsag']
const FILTER_LABELS: Record<FilterKey, string> = {
  szuronap: 'Szűrőnapok', irodai: 'Irodai hetes', egyeb: 'Egyéb', szabadsag: 'Szabadságok',
}

const MONTHS = ['Január','Február','Március','Április','Május','Június','Július','Augusztus','Szeptember','Október','November','December']
const DAYS = ['H','K','Sze','Cs','P','Szo','V']

function isSameDayUTC(a: Date, b: Date) {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate()
}
function getMonday(date: Date): Date {
  const d = new Date(date); d.setUTCHours(0,0,0,0)
  const day = d.getUTCDay(); d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day)); return d
}
function isWeekday(date: Date) { const d = date.getUTCDay(); return d >= 1 && d <= 5 }
function uName(u: SimpleUser | OfficeWeek['assignedUser'] | Vacation['user'] | null): string {
  if (!u) return '—'; return (u as SimpleUser).nickname || (u as SimpleUser).firstName || u.name || '—'
}

export default function ShiftsPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [shifts, setShifts] = useState<ShiftDay[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [officeWeeks, setOfficeWeeks] = useState<OfficeWeek[]>([])
  const [vacations, setVacations] = useState<Vacation[]>([])
  const [allUsers, setAllUsers] = useState<SimpleUser[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFilters, setActiveFilters] = useState<Set<FilterKey>>(new Set(ALL_FILTERS))
  const [selectedDayItems, setSelectedDayItems] = useState<DayItem[]>([])
  const [selectedItem, setSelectedItem] = useState<DayItem | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)
  const [showNewModal, setShowNewModal] = useState(false)
  const [newDate, setNewDate] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [currentUserId, setCurrentUserId] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    const [s, e, w, v, me] = await Promise.all([
      fetch(`/api/shifts?year=${year}&month=${month}`),
      fetch(`/api/calendar-events?year=${year}&month=${month}`),
      fetch(`/api/office-weeks?year=${year}&month=${month}`),
      fetch(`/api/vacations?year=${year}&month=${month}`),
      fetch('/api/auth/me'),
    ])
    const [sd, ed, wd, vd, md] = await Promise.all([s.json(), e.json(), w.json(), v.json(), me.json()])
    setShifts(sd.shifts || [])
    setEvents(ed.events || [])
    setOfficeWeeks(wd.weeks || [])
    setVacations(vd.vacations || [])
    setAllUsers(wd.users || [])
    setIsAdmin(md?.user?.role === 'ADMIN')
    setCurrentUserId(md?.user?.id || '')
    setLoading(false)
  }, [year, month])

  useEffect(() => { loadData() }, [loadData])

  function toggleFilter(key: FilterKey) {
    setActiveFilters(prev => {
      const next = new Set(prev)
      if (next.has(key)) { next.delete(key) } else { next.add(key) }
      return next
    })
  }
  function toggleAll() { setActiveFilters(new Set(ALL_FILTERS)) }
  const isAllActive = ALL_FILTERS.every(f => activeFilters.has(f))

  function prevMonth() { if (month === 1) { setMonth(12); setYear(y => y-1) } else setMonth(m => m-1) }
  function nextMonth() { if (month === 12) { setMonth(1); setYear(y => y+1) } else setMonth(m => m+1) }

  async function triggerSync() {
    setSyncing(true); setSyncResult(null)
    const r = await fetch('/api/shifts/sync', { method: 'POST' })
    const d = await r.json()
    setSyncResult(r.ok ? `✓ Szinkronizálva: ${d.upserted} szűrőnap` : `Hiba: ${d.error}`)
    if (r.ok) loadData()
    setSyncing(false)
  }

  function getOfficeWeekForDay(day: number): OfficeWeek | null {
    const d = new Date(Date.UTC(year, month-1, day))
    if (!isWeekday(d)) return null
    const monday = getMonday(d)
    return officeWeeks.find(w => isSameDayUTC(new Date(w.weekStart), monday)) || null
  }

  function shiftsForDay(day: number) {
    const d = new Date(Date.UTC(year, month-1, day))
    return shifts.filter(s => isSameDayUTC(new Date(s.date), d))
  }
  function eventsForDay(day: number) {
    const d = new Date(Date.UTC(year, month-1, day))
    return events.filter(e => isSameDayUTC(new Date(e.date), d))
  }
  function vacationsForDay(day: number) {
    const d = new Date(Date.UTC(year, month-1, day))
    return vacations.filter(v => {
      const s = new Date(v.startDate); const e = new Date(v.endDate)
      return d >= s && d <= e
    })
  }

  function openDay(day: number) {
    const d = new Date(Date.UTC(year, month-1, day))
    const items: DayItem[] = []
    if (activeFilters.has('irodai')) { const ow = getOfficeWeekForDay(day); if (ow) items.push({ kind: 'office', data: ow }) }
    if (activeFilters.has('szuronap')) shiftsForDay(day).forEach(s => items.push({ kind: 'shift', data: s }))
    if (activeFilters.has('szabadsag')) vacationsForDay(day).forEach(v => items.push({ kind: 'vacation', data: v }))
    if (activeFilters.has('egyeb')) eventsForDay(day).forEach(e => items.push({ kind: 'event', data: e }))

    if (items.length === 0) {
      setNewDate(d.toISOString().split('T')[0]); setShowNewModal(true)
    } else {
      setSelectedDayItems(items); setSelectedItem(items[0])
    }
  }

  function closeDetail() { setSelectedDayItems([]); setSelectedItem(null) }

  const firstDay = new Date(Date.UTC(year, month-1, 1))
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const startOffset = (firstDay.getUTCDay() + 6) % 7
  const cells: (number | null)[] = [...Array(startOffset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i+1)]
  while (cells.length % 7 !== 0) cells.push(null)

  const upcomingShifts = shifts
    .filter(s => new Date(s.date) >= new Date(now.getFullYear(), now.getMonth(), now.getDate()))
    .slice(0, 5)

  const selectedDetail = selectedItem

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Naptár</h1>
          <p className="text-gray-500 text-sm mt-0.5">Szűrőnapok, irodai hetes, szabadságok, egyéb</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setNewDate(''); setShowNewModal(true) }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-xl" style={{ background: '#6C5CE7' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Új bejegyzés
          </button>
          <button onClick={triggerSync} disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 disabled:opacity-60">
            <svg className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {syncing ? 'Szinkronizálás...' : 'Frissítés'}
          </button>
        </div>
      </div>

      {/* Multi-select filters */}
      <div className="flex flex-wrap gap-2 mb-5">
        <button onClick={toggleAll}
          className={`px-4 py-1.5 rounded-xl text-sm font-medium border transition-all ${isAllActive ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}>
          Összes
        </button>
        <button onClick={() => toggleFilter('szuronap')}
          className={`px-4 py-1.5 rounded-xl text-sm font-medium border transition-all ${activeFilters.has('szuronap') ? 'text-white border-transparent' : 'border-gray-200 text-gray-500 hover:border-indigo-300'}`}
          style={activeFilters.has('szuronap') ? { background: '#6C5CE7' } : {}}>
          Szűrőnapok
        </button>
        <button onClick={() => toggleFilter('irodai')}
          className={`px-4 py-1.5 rounded-xl text-sm font-medium border transition-all ${activeFilters.has('irodai') ? 'bg-orange-400 text-white border-transparent' : 'border-gray-200 text-gray-500 hover:border-orange-300'}`}>
          Irodai hetes
        </button>
        <button onClick={() => toggleFilter('szabadsag')}
          className={`px-4 py-1.5 rounded-xl text-sm font-medium border transition-all ${activeFilters.has('szabadsag') ? 'bg-sky-400 text-white border-transparent' : 'border-gray-200 text-gray-500 hover:border-sky-300'}`}>
          Szabadságok
        </button>
        <button onClick={() => toggleFilter('egyeb')}
          className={`px-4 py-1.5 rounded-xl text-sm font-medium border transition-all ${activeFilters.has('egyeb') ? 'bg-teal-500 text-white border-transparent' : 'border-gray-200 text-gray-500 hover:border-teal-300'}`}>
          Egyéb
        </button>
      </div>

      {syncResult && (
        <div className={`mb-4 px-4 py-3 rounded-xl text-sm ${syncResult.startsWith('✓') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {syncResult}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <h2 className="text-base font-semibold text-gray-900">{MONTHS[month-1]} {year}</h2>
            <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
          <div className="grid grid-cols-7 mb-2">
            {DAYS.map(d => <div key={d} className="text-center text-xs font-semibold text-gray-400 py-1">{d}</div>)}
          </div>
          {loading ? (
            <div className="py-12 text-center text-gray-400 text-sm">Betöltés...</div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {cells.map((day, i) => {
                if (!day) return <div key={i} />
                const d = new Date(Date.UTC(year, month-1, day))
                const isToday = isSameDayUTC(d, now)
                const dayShifts = activeFilters.has('szuronap') ? shiftsForDay(day) : []
                const dayEvents = activeFilters.has('egyeb') ? eventsForDay(day) : []
                const officeWeek = activeFilters.has('irodai') ? getOfficeWeekForDay(day) : null
                const dayVacs = activeFilters.has('szabadsag') ? vacationsForDay(day) : []
                return (
                  <div key={i} onClick={() => openDay(day)}
                    className={`min-h-[64px] rounded-lg p-1 cursor-pointer border transition-all ${isToday ? 'border-indigo-300 bg-indigo-50' : 'border-transparent hover:border-gray-200 hover:bg-gray-50'}`}>
                    <p className={`text-xs font-medium text-right mb-1 ${isToday ? 'text-indigo-600' : 'text-gray-500'}`}>{day}</p>
                    {officeWeek && (
                      <div className="text-[10px] leading-tight rounded px-1 py-0.5 mb-0.5 text-white truncate bg-orange-400">
                        🧹 {uName(officeWeek.assignedUser)}
                      </div>
                    )}
                    {dayShifts.map(s => (
                      <div key={s.id} className="text-[10px] leading-tight rounded px-1 py-0.5 mb-0.5 truncate"
                        style={{
                          background: s.bgColor ?? (s.forSelf ? '#e53e3e' : '#6C5CE7'),
                          color: s.bgColor ? '#1a1a1a' : 'white',
                          opacity: s.strikethrough ? 0.4 : 1,
                        }}>
                        {s.location || s.shopName || '—'}
                      </div>
                    ))}
                    {dayVacs.map(v => (
                      <div key={v.id} className="text-[10px] leading-tight rounded px-1 py-0.5 mb-0.5 text-white truncate bg-sky-400">
                        🏖 {uName(v.user)}
                      </div>
                    ))}
                    {dayEvents.map(e => (
                      <div key={e.id} className="text-[10px] leading-tight rounded px-1 py-0.5 mb-0.5 text-white truncate bg-teal-500">
                        {e.title}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {selectedDetail ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900">Részletek</h3>
                <button onClick={closeDetail} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              {selectedDayItems.length > 1 && (
                <div className="flex gap-1 mb-4 flex-wrap">
                  {selectedDayItems.map((item, idx) => {
                    const active = selectedItem === item
                    const label = item.kind === 'shift' ? (item.data.shopName || item.data.location || 'Szűrőnap')
                      : item.kind === 'office' ? '🧹 Hetes'
                      : item.kind === 'vacation' ? `🏖 ${uName(item.data.user)}`
                      : item.data.title
                    const bg = item.kind === 'shift'
                      ? (item.data.bgColor ?? (item.data.forSelf ? '#e53e3e' : '#6C5CE7'))
                      : item.kind === 'office' ? '#fb923c'
                      : item.kind === 'vacation' ? '#38bdf8'
                      : '#14b8a6'
                    return (
                      <button key={idx} onClick={() => setSelectedItem(item)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${active ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        style={active ? { background: bg } : {}}>
                        {label}
                      </button>
                    )
                  })}
                </div>
              )}
              {selectedItem?.kind === 'shift' && <ShiftDetail shift={selectedItem.data} />}
              {selectedItem?.kind === 'event' && <EventDetail event={selectedItem.data} onDelete={async () => {
                await fetch(`/api/calendar-events/${(selectedItem.data as CalendarEvent).id}`, { method: 'DELETE' })
                closeDetail(); loadData()
              }} />}
              {selectedItem?.kind === 'office' && <OfficeWeekDetail week={selectedItem.data} allUsers={allUsers} isAdmin={isAdmin} onChanged={loadData} />}
              {selectedItem?.kind === 'vacation' && (
                <VacationDetail vacation={selectedItem.data}
                  canDelete={(selectedItem.data as Vacation).user.id === currentUserId || isAdmin}
                  onDelete={async () => {
                    await fetch(`/api/vacations/${(selectedItem.data as Vacation).id}`, { method: 'DELETE' })
                    closeDetail(); loadData()
                  }} />
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Következő szűrőnapok</h3>
              {upcomingShifts.length === 0 ? <p className="text-sm text-gray-400">Nincs közelgő szűrőnap</p> : (
                <div className="space-y-3">
                  {upcomingShifts.map(s => (
                    <button key={s.id} onClick={() => { const item: DayItem = { kind: 'shift', data: s }; setSelectedDayItems([item]); setSelectedItem(item) }}
                      className="w-full text-left p-3 rounded-lg border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/50 transition-all">
                      <p className="text-xs text-gray-400 mb-0.5">
                        {new Date(s.date).toLocaleDateString('hu-HU', { month: 'long', day: 'numeric', weekday: 'short' })}
                        {s.timeStart && ` · ${s.timeStart}${s.timeEnd ? `–${s.timeEnd}` : ''}`}
                      </p>
                      <p className="text-sm font-medium text-gray-900 truncate">{s.shopName || s.location || '—'}</p>
                      {s.assignedTo && <p className="text-xs text-indigo-600 mt-0.5">{s.assignedTo}</p>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-xs text-gray-400">
            <p className="font-medium text-gray-500 mb-1">Szinkronizáció</p>
            {shifts.length > 0 ? <p>Utoljára frissítve: {new Date(shifts[0].syncedAt).toLocaleString('hu-HU')}</p> : <p>Még nem volt szinkronizáció</p>}
            <p className="mt-1">{shifts.length} szűrőnap ebben a hónapban</p>
          </div>
        </div>
      </div>

      {showNewModal && <NewEntryModal initialDate={newDate} currentUserId={currentUserId} onClose={() => setShowNewModal(false)} onSaved={() => { setShowNewModal(false); loadData() }} />}
    </div>
  )
}

function ShiftDetail({ shift }: { shift: ShiftDay }) {
  const date = new Date(shift.date)
  return (
    <div className="space-y-3 text-sm">
      {shift.strikethrough && (
        <div className="flex items-center gap-1.5 px-2 py-1.5 bg-gray-100 rounded-lg text-gray-500 text-xs">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
          Elmaradt szűrőnap
        </div>
      )}
      <div><p className="text-xs text-gray-400 mb-0.5">Dátum</p><p className="font-medium text-gray-900">{date.toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</p></div>
      {(shift.timeStart || shift.timeEnd) && <div><p className="text-xs text-gray-400 mb-0.5">Időpont</p><p className="text-gray-900">{shift.timeStart}{shift.timeEnd ? ` – ${shift.timeEnd}` : ''}</p></div>}
      {shift.shopName && <div><p className="text-xs text-gray-400 mb-0.5">Bolt neve</p><p className="text-gray-900">{shift.shopName}</p></div>}
      {shift.location && <div><p className="text-xs text-gray-400 mb-0.5">Helyszín</p><p className="text-gray-900">{shift.location}</p></div>}
      {shift.address && <div><p className="text-xs text-gray-400 mb-0.5">Cím</p><p className="text-gray-900">{shift.address}</p></div>}
      {shift.assignedTo && <div><p className="text-xs text-gray-400 mb-0.5">Ki megy</p><p className="font-medium text-indigo-700">{shift.assignedTo}</p></div>}
      {shift.adMode && <div><p className="text-xs text-gray-400 mb-0.5">Hirdetési mód</p><p className="text-gray-900">{shift.adMode}</p></div>}
      {shift.contactPhone && <div><p className="text-xs text-gray-400 mb-0.5">Telefon</p><a href={`tel:${shift.contactPhone}`} className="text-indigo-600 hover:underline">{shift.contactPhone}</a></div>}
      {shift.contactEmail && <div><p className="text-xs text-gray-400 mb-0.5">Email</p><a href={`mailto:${shift.contactEmail}`} className="text-indigo-600 hover:underline truncate block">{shift.contactEmail}</a></div>}
      {shift.notes && <div><p className="text-xs text-gray-400 mb-0.5">Megjegyzések</p><p className="text-gray-700 text-xs leading-relaxed">{shift.notes}</p></div>}
      {shift.shopCode && <div><p className="text-xs text-gray-400 mb-0.5">Boltkód</p><span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-mono">{shift.shopCode}</span></div>}
    </div>
  )
}

function EventDetail({ event, onDelete }: { event: CalendarEvent; onDelete: () => void }) {
  const creatorName = event.createdBy ? event.createdBy.nickname || event.createdBy.firstName || event.createdBy.name || event.createdBy.email : null
  return (
    <div className="space-y-3 text-sm">
      <div><p className="text-xs text-gray-400 mb-0.5">Dátum</p><p className="font-medium text-gray-900">{new Date(event.date).toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</p></div>
      <div><p className="text-xs text-gray-400 mb-0.5">Bejegyzés</p><p className="font-medium text-gray-900">{event.title}</p></div>
      {event.description && <div><p className="text-xs text-gray-400 mb-0.5">Leírás</p><p className="text-gray-700 text-xs leading-relaxed">{event.description}</p></div>}
      {creatorName && <div><p className="text-xs text-gray-400 mb-0.5">Rögzítette</p><p className="text-gray-900">{creatorName}</p></div>}
      <button onClick={onDelete} className="mt-2 w-full text-center text-xs text-red-500 hover:text-red-700 py-1.5 border border-red-100 rounded-lg hover:bg-red-50 transition-all">Törlés</button>
    </div>
  )
}

function VacationDetail({ vacation, canDelete, onDelete }: { vacation: Vacation; canDelete: boolean; onDelete: () => void }) {
  const start = new Date(vacation.startDate)
  const end = new Date(vacation.endDate)
  const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">🏖</span>
        <span className="font-medium text-gray-900">Szabadság</span>
      </div>
      <div><p className="text-xs text-gray-400 mb-0.5">Kolléga</p><p className="font-medium text-sky-600">{vacation.user.nickname || vacation.user.firstName || vacation.user.name || vacation.user.email}</p></div>
      <div><p className="text-xs text-gray-400 mb-0.5">Időszak</p>
        <p className="text-gray-900">{start.toLocaleDateString('hu-HU', { month: 'long', day: 'numeric' })} – {end.toLocaleDateString('hu-HU', { month: 'long', day: 'numeric' })}</p>
        <p className="text-xs text-gray-400 mt-0.5">{days} nap</p>
      </div>
      {vacation.note && <div><p className="text-xs text-gray-400 mb-0.5">Megjegyzés</p><p className="text-gray-700 text-xs">{vacation.note}</p></div>}
      {canDelete && <button onClick={onDelete} className="mt-2 w-full text-center text-xs text-red-500 hover:text-red-700 py-1.5 border border-red-100 rounded-lg hover:bg-red-50 transition-all">Törlés</button>}
    </div>
  )
}

function OfficeWeekDetail({ week, allUsers, isAdmin, onChanged }: { week: OfficeWeek; allUsers: SimpleUser[]; isAdmin: boolean; onChanged: () => void }) {
  const [editing, setEditing] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState(week.assignedUser?.id || '')
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState('')

  const weekStart = new Date(week.weekStart)
  const weekEnd = new Date(weekStart); weekEnd.setUTCDate(weekEnd.getUTCDate() + 4)

  async function handleSave() {
    setSaving(true)
    await fetch(`/api/office-weeks/${week.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assignedUserId: selectedUserId }) })
    setSaving(false); setEditing(false); onChanged()
  }

  async function handleSendEmail() {
    setSending(true); setSendResult('')
    const r = await fetch(`/api/office-weeks/${week.id}/remind`, { method: 'POST' })
    setSendResult(r.ok ? '✓ E-mail elküldve' : '✗ Hiba az e-mail küldésekor')
    setSending(false)
  }

  return (
    <div className="space-y-3 text-sm">
      <div><p className="text-xs text-gray-400 mb-0.5">Hét</p>
        <p className="font-medium text-gray-900">{weekStart.toLocaleDateString('hu-HU', { month: 'long', day: 'numeric' })} – {weekEnd.toLocaleDateString('hu-HU', { month: 'long', day: 'numeric' })}</p>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-gray-400">Irodai hetes</p>
          {week.isManual && <span className="text-[10px] text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded">Módosítva</span>}
        </div>
        {editing ? (
          <div className="space-y-2">
            <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300">
              {allUsers.map(u => <option key={u.id} value={u.id}>{u.nickname || u.firstName || u.name || u.id}</option>)}
            </select>
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="flex-1 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Mégse</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-1.5 text-xs text-white rounded-lg disabled:opacity-60 bg-orange-400 hover:bg-orange-500">{saving ? 'Mentés...' : 'Mentés'}</button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className="font-medium text-gray-900 text-base">🧹 {week.assignedUser ? (week.assignedUser.nickname || week.assignedUser.firstName || week.assignedUser.name || week.assignedUser.email) : '—'}</p>
            {isAdmin && <button onClick={() => setEditing(true)} className="text-xs text-orange-500 hover:text-orange-700 px-2 py-1 rounded-lg hover:bg-orange-50 transition-all">Módosítás</button>}
          </div>
        )}
      </div>
      {isAdmin && !editing && (
        <div>
          <button onClick={handleSendEmail} disabled={sending}
            className="w-full flex items-center justify-center gap-2 py-1.5 text-xs text-orange-600 border border-orange-200 rounded-lg hover:bg-orange-50 transition-all disabled:opacity-60">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            {sending ? 'Küldés...' : 'E-mail küldése a hetesnek'}
          </button>
          {sendResult && <p className={`text-xs mt-1 text-center ${sendResult.startsWith('✓') ? 'text-green-600' : 'text-red-500'}`}>{sendResult}</p>}
        </div>
      )}
      <div className="pt-2 border-t border-gray-100">
        <p className="text-xs text-gray-400 mb-2">Feladatok erre a hétre</p>
        <ul className="space-y-1 text-xs text-gray-600">
          <li>• Konyha tisztántartása (pult, asztal, csepegtető alatt törlés)</li>
          <li>• Ebéd után a mosogatógép elindítása, délután/másnap reggel kipakolása</li>
          <li>• Csepegtetőn lévő elmosott dolgok elpakolása</li>
          <li>• Mikró takarítása</li>
          <li>• Kuka napi ürítése</li>
        </ul>
      </div>
    </div>
  )
}

function NewEntryModal({ initialDate, currentUserId, onClose, onSaved }: { initialDate: string; currentUserId: string; onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState<'egyeb' | 'szabadsag'>('egyeb')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(initialDate || new Date().toISOString().split('T')[0])
  const [startDate, setStartDate] = useState(initialDate || new Date().toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(initialDate || new Date().toISOString().split('T')[0])
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Notification state
  const [sendNotify, setSendNotify] = useState(false)
  const [notifyAll, setNotifyAll] = useState(true)
  const [allUsers, setAllUsers] = useState<{ id: string; name: string | null; firstName: string | null; nickname: string | null; email: string }[]>([])
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/users').then(r => r.json()).then(d => {
      const users = (d.users || []).filter((u: { id: string; status: string }) => u.id !== currentUserId && u.status === 'ACTIVE')
      setAllUsers(users)
    })
  }, [currentUserId])

  function toggleUser(id: string) {
    setSelectedUserIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const userNameMap = useMemo(() => buildUniqueDisplayNames(allUsers), [allUsers])

  async function handleSave() {
    setError('')
    if (type === 'egyeb' && !title.trim()) { setError('A cím megadása kötelező'); return }
    if (type === 'szabadsag' && !startDate) { setError('Kezdő dátum kötelező'); return }
    setSaving(true)
    let r: Response
    if (type === 'egyeb') {
      const notifyUserIds = sendNotify ? (notifyAll ? allUsers.map(u => u.id) : Array.from(selectedUserIds)) : []
      r = await fetch('/api/calendar-events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: title.trim(), description: description.trim() || null, date, type: 'EGYEB', notifyUserIds }) })
    } else {
      r = await fetch('/api/vacations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ startDate, endDate, note: note.trim() || null }) })
    }
    if (r.ok) { onSaved() } else { const d = await r.json(); setError(d.error || 'Hiba történt'); setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Új bejegyzés</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="flex gap-2 mb-4">
          <button onClick={() => setType('egyeb')} className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${type === 'egyeb' ? 'bg-teal-500 text-white border-transparent' : 'border-gray-200 text-gray-500'}`}>Egyéb</button>
          <button onClick={() => setType('szabadsag')} className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${type === 'szabadsag' ? 'bg-sky-400 text-white border-transparent' : 'border-gray-200 text-gray-500'}`}>🏖 Szabadság</button>
        </div>
        <div className="space-y-3">
          {type === 'egyeb' ? (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Dátum</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Cím *</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="pl. Csapattalálkozó" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Leírás (opcionális)</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300 resize-none" />
              </div>
              {/* Notification section */}
              <div className="border-t border-gray-100 pt-3">
                <label className="flex items-center gap-2 cursor-pointer select-none mb-2">
                  <div
                    className="relative w-9 h-5 rounded-full transition-colors cursor-pointer flex-shrink-0"
                    style={{ background: sendNotify ? '#14B8A6' : '#e5e7eb' }}
                    onClick={() => setSendNotify(v => !v)}
                  >
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${sendNotify ? 'translate-x-4' : ''}`} />
                  </div>
                  <span className="text-sm text-gray-700">E-mail értesítő küldése</span>
                </label>
                {sendNotify && (
                  <div className="pl-1 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" checked={notifyAll} onChange={() => setNotifyAll(true)} className="accent-teal-500" />
                      <span className="text-sm text-gray-700">Mindenki</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" checked={!notifyAll} onChange={() => setNotifyAll(false)} className="accent-teal-500" />
                      <span className="text-sm text-gray-700">Kiválasztott személyek</span>
                    </label>
                    {!notifyAll && (
                      <div className="ml-5 mt-1 max-h-36 overflow-y-auto space-y-1 border border-gray-100 rounded-xl p-2">
                        {allUsers.map(u => (
                          <label key={u.id} className="flex items-center gap-2 cursor-pointer py-0.5">
                            <input type="checkbox" checked={selectedUserIds.has(u.id)} onChange={() => toggleUser(u.id)} className="accent-teal-500" />
                            <span className="text-sm text-gray-700">{userNameMap[u.id] || u.email}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-gray-400 pl-0.5">Akinek ki van kapcsolva az "Egyéb naptáresemény" értesítő, az nem kap e-mailt.</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Kezdete</label>
                  <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); if (e.target.value > endDate) setEndDate(e.target.value) }} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Vége</label>
                  <input type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Megjegyzés (opcionális)</label>
                <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="pl. nyári szabadság" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300" />
              </div>
            </>
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50">Mégse</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2 text-sm font-medium text-white rounded-xl disabled:opacity-60"
            style={{ background: type === 'szabadsag' ? '#38BDF8' : '#14B8A6' }}>
            {saving ? 'Mentés...' : 'Mentés'}
          </button>
        </div>
      </div>
    </div>
  )
}

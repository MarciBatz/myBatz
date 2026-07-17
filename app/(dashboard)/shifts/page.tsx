'use client'

import { useState, useEffect, useCallback } from 'react'

interface ShiftDay {
  id: string
  date: string
  timeStart: string | null
  timeEnd: string | null
  location: string | null
  shopName: string | null
  address: string | null
  contactEmail: string | null
  contactPhone: string | null
  adMode: string | null
  assignedTo: string | null
  forSelf: boolean
  notes: string | null
  shopCode: string | null
  syncedAt: string
}

interface CalendarEvent {
  id: string
  title: string
  description: string | null
  date: string
  type: string
  createdBy: { firstName: string | null; name: string | null; nickname: string | null; email: string } | null
}

interface OfficeWeek {
  id: string
  weekStart: string
  isManual: boolean
  assignedUser: { id: string; name: string | null; firstName: string | null; lastName: string | null; nickname: string | null; email: string } | null
}

interface SimpleUser {
  id: string
  name: string | null
  firstName: string | null
  lastName: string | null
  nickname: string | null
}

type FilterType = 'osszes' | 'szuronap' | 'irodai' | 'egyeb'

const MONTHS = ['Január', 'Február', 'Március', 'Április', 'Május', 'Június',
  'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December']
const DAYS = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V']

const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'osszes', label: 'Összes' },
  { key: 'szuronap', label: 'Szűrőnapok' },
  { key: 'irodai', label: 'Irodai hetes' },
  { key: 'egyeb', label: 'Egyéb' },
]

function isSameDay(a: Date, b: Date) {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate()
}

function getMonday(date: Date): Date {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  return d
}

function userName(u: SimpleUser | OfficeWeek['assignedUser']): string {
  if (!u) return '—'
  return u.nickname || u.firstName || u.name || '—'
}

function isWeekday(date: Date): boolean {
  const day = date.getUTCDay()
  return day >= 1 && day <= 5
}

export default function ShiftsPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [shifts, setShifts] = useState<ShiftDay[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [officeWeeks, setOfficeWeeks] = useState<OfficeWeek[]>([])
  const [allUsers, setAllUsers] = useState<SimpleUser[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>('osszes')
  const [selectedDayShifts, setSelectedDayShifts] = useState<ShiftDay[]>([])
  const [selectedShift, setSelectedShift] = useState<ShiftDay | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [selectedOfficeWeek, setSelectedOfficeWeek] = useState<OfficeWeek | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)
  const [showNewModal, setShowNewModal] = useState(false)
  const [newDate, setNewDate] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    const [shiftsRes, eventsRes, weeksRes, meRes] = await Promise.all([
      fetch(`/api/shifts?year=${year}&month=${month}`),
      fetch(`/api/calendar-events?year=${year}&month=${month}`),
      fetch(`/api/office-weeks?year=${year}&month=${month}`),
      fetch('/api/auth/me'),
    ])
    const [shiftsData, eventsData, weeksData, meData] = await Promise.all([
      shiftsRes.json(), eventsRes.json(), weeksRes.json(), meRes.json(),
    ])
    setShifts(shiftsData.shifts || [])
    setEvents(eventsData.events || [])
    setOfficeWeeks(weeksData.weeks || [])
    setAllUsers(weeksData.users || [])
    setIsAdmin(meData?.user?.role === 'ADMIN')
    setLoading(false)
  }, [year, month])

  useEffect(() => { loadData() }, [loadData])

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }

  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  async function triggerSync() {
    setSyncing(true)
    setSyncResult(null)
    const r = await fetch('/api/shifts/sync', { method: 'POST' })
    const d = await r.json()
    setSyncResult(r.ok ? `✓ Szinkronizálva: ${d.upserted} szűrőnap` : `Hiba: ${d.error}`)
    if (r.ok) loadData()
    setSyncing(false)
  }

  function getOfficeWeekForDay(day: number): OfficeWeek | null {
    const d = new Date(Date.UTC(year, month - 1, day))
    if (!isWeekday(d)) return null
    const monday = getMonday(d)
    return officeWeeks.find(w => isSameDay(new Date(w.weekStart), monday)) || null
  }

  function openDay(day: number) {
    const d = new Date(Date.UTC(year, month - 1, day))
    const showShifts = filter === 'osszes' || filter === 'szuronap'
    const showEvents = filter === 'osszes' || filter === 'egyeb'
    const showIrodai = filter === 'osszes' || filter === 'irodai'

    const dayShifts = showShifts ? shiftsForDay(day) : []
    const dayEvents = showEvents ? eventsForDay(day) : []
    const officeWeek = showIrodai ? getOfficeWeekForDay(day) : null

    if (dayShifts.length > 0) {
      setSelectedDayShifts(dayShifts); setSelectedShift(dayShifts[0])
      setSelectedEvent(null); setSelectedOfficeWeek(null)
    } else if (dayEvents.length > 0) {
      setSelectedEvent(dayEvents[0])
      setSelectedShift(null); setSelectedDayShifts([]); setSelectedOfficeWeek(null)
    } else if (officeWeek) {
      setSelectedOfficeWeek(officeWeek)
      setSelectedShift(null); setSelectedDayShifts([]); setSelectedEvent(null)
    } else {
      setNewDate(d.toISOString().split('T')[0])
      setShowNewModal(true)
    }
  }

  function closeDetail() {
    setSelectedShift(null); setSelectedEvent(null)
    setSelectedDayShifts([]); setSelectedOfficeWeek(null)
  }

  const firstDay = new Date(Date.UTC(year, month - 1, 1))
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const startOffset = (firstDay.getUTCDay() + 6) % 7
  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  function shiftsForDay(day: number) {
    const d = new Date(Date.UTC(year, month - 1, day))
    return shifts.filter(s => isSameDay(new Date(s.date), d))
  }

  function eventsForDay(day: number) {
    const d = new Date(Date.UTC(year, month - 1, day))
    return events.filter(e => isSameDay(new Date(e.date), d))
  }

  const upcomingShifts = shifts
    .filter(s => new Date(s.date) >= new Date(now.getFullYear(), now.getMonth(), now.getDate()))
    .slice(0, 5)

  const selectedDetail = selectedShift || selectedEvent || selectedOfficeWeek

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Naptár</h1>
          <p className="text-gray-500 text-sm mt-0.5">Szűrőnapok, irodai hetes, egyéb bejegyzések</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setNewDate(''); setShowNewModal(true) }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-xl"
            style={{ background: '#6C5CE7' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
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

      <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-xl w-fit">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${filter === f.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {f.label}
          </button>
        ))}
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
            <h2 className="text-base font-semibold text-gray-900">{MONTHS[month - 1]} {year}</h2>
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
                const d = new Date(Date.UTC(year, month - 1, day))
                const isToday = isSameDay(d, now)
                const showShifts = filter === 'osszes' || filter === 'szuronap'
                const showEvents = filter === 'osszes' || filter === 'egyeb'
                const showIrodai = filter === 'osszes' || filter === 'irodai'
                const dayShifts = showShifts ? shiftsForDay(day) : []
                const dayEvents = showEvents ? eventsForDay(day) : []
                const officeWeek = showIrodai ? getOfficeWeekForDay(day) : null
                const hasItems = dayShifts.length > 0 || dayEvents.length > 0 || !!officeWeek

                return (
                  <div key={i} onClick={() => openDay(day)}
                    className={`min-h-[64px] rounded-lg p-1 cursor-pointer border transition-all ${isToday ? 'border-indigo-300 bg-indigo-50' : 'border-transparent hover:border-gray-200 hover:bg-gray-50'}`}>
                    <p className={`text-xs font-medium text-right mb-1 ${isToday ? 'text-indigo-600' : 'text-gray-500'}`}>{day}</p>
                    {officeWeek && (
                      <div className="text-[10px] leading-tight rounded px-1 py-0.5 mb-0.5 text-white truncate bg-orange-400">
                        🧹 {userName(officeWeek.assignedUser)}
                      </div>
                    )}
                    {dayShifts.map(s => (
                      <div key={s.id} className="text-[10px] leading-tight rounded px-1 py-0.5 mb-0.5 text-white truncate"
                        style={{ background: s.forSelf ? '#e53e3e' : '#6C5CE7' }}>
                        {s.location || s.shopName || '—'}
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
              {selectedDayShifts.length > 1 && (
                <div className="flex gap-1 mb-4 flex-wrap">
                  {selectedDayShifts.map((s, idx) => (
                    <button key={s.id} onClick={() => { setSelectedShift(s); setSelectedEvent(null); setSelectedOfficeWeek(null) }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${selectedShift?.id === s.id ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                      style={selectedShift?.id === s.id ? { background: s.forSelf ? '#e53e3e' : '#6C5CE7' } : {}}>
                      {idx + 1}. {s.shopName || s.location || 'Szűrőnap'}
                    </button>
                  ))}
                </div>
              )}
              {selectedShift && <ShiftDetail shift={selectedShift} />}
              {selectedEvent && <EventDetail event={selectedEvent} onDelete={async () => {
                await fetch(`/api/calendar-events/${selectedEvent.id}`, { method: 'DELETE' })
                closeDetail(); loadData()
              }} />}
              {selectedOfficeWeek && (
                <OfficeWeekDetail
                  week={selectedOfficeWeek}
                  allUsers={allUsers}
                  isAdmin={isAdmin}
                  onChanged={loadData}
                />
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Következő szűrőnapok</h3>
              {upcomingShifts.length === 0 ? (
                <p className="text-sm text-gray-400">Nincs közelgő szűrőnap</p>
              ) : (
                <div className="space-y-3">
                  {upcomingShifts.map(s => (
                    <button key={s.id} onClick={() => { setSelectedDayShifts([s]); setSelectedShift(s); setSelectedEvent(null); setSelectedOfficeWeek(null) }}
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
            {shifts.length > 0
              ? <p>Utoljára frissítve: {new Date(shifts[0].syncedAt).toLocaleString('hu-HU')}</p>
              : <p>Még nem volt szinkronizáció</p>}
            <p className="mt-1">{shifts.length} szűrőnap ebben a hónapban</p>
          </div>
        </div>
      </div>

      {showNewModal && (
        <NewEventModal
          initialDate={newDate}
          onClose={() => setShowNewModal(false)}
          onSaved={() => { setShowNewModal(false); loadData() }}
        />
      )}
    </div>
  )
}

function ShiftDetail({ shift }: { shift: ShiftDay }) {
  const date = new Date(shift.date)
  return (
    <div className="space-y-3 text-sm">
      <div><p className="text-xs text-gray-400 mb-0.5">Dátum</p>
        <p className="font-medium text-gray-900">{date.toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</p></div>
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
  const date = new Date(event.date)
  const creatorName = event.createdBy
    ? event.createdBy.nickname || event.createdBy.firstName || event.createdBy.name || event.createdBy.email
    : null
  return (
    <div className="space-y-3 text-sm">
      <div><p className="text-xs text-gray-400 mb-0.5">Dátum</p>
        <p className="font-medium text-gray-900">{date.toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</p></div>
      <div><p className="text-xs text-gray-400 mb-0.5">Bejegyzés</p><p className="font-medium text-gray-900">{event.title}</p></div>
      {event.description && <div><p className="text-xs text-gray-400 mb-0.5">Leírás</p><p className="text-gray-700 text-xs leading-relaxed">{event.description}</p></div>}
      {creatorName && <div><p className="text-xs text-gray-400 mb-0.5">Rögzítette</p><p className="text-gray-900">{creatorName}</p></div>}
      <button onClick={onDelete} className="mt-2 w-full text-center text-xs text-red-500 hover:text-red-700 py-1.5 border border-red-100 rounded-lg hover:bg-red-50 transition-all">
        Törlés
      </button>
    </div>
  )
}

function OfficeWeekDetail({ week, allUsers, isAdmin, onChanged }: {
  week: OfficeWeek
  allUsers: SimpleUser[]
  isAdmin: boolean
  onChanged: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState(week.assignedUser?.id || '')
  const [saving, setSaving] = useState(false)

  const weekStart = new Date(week.weekStart)
  const weekEnd = new Date(weekStart)
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 4)

  async function handleSave() {
    setSaving(true)
    await fetch(`/api/office-weeks/${week.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignedUserId: selectedUserId }),
    })
    setSaving(false)
    setEditing(false)
    onChanged()
  }

  function uName(u: SimpleUser) {
    return u.nickname || u.firstName || u.name || u.id
  }

  return (
    <div className="space-y-3 text-sm">
      <div>
        <p className="text-xs text-gray-400 mb-0.5">Hét</p>
        <p className="font-medium text-gray-900">
          {weekStart.toLocaleDateString('hu-HU', { month: 'long', day: 'numeric' })} –{' '}
          {weekEnd.toLocaleDateString('hu-HU', { month: 'long', day: 'numeric' })}
        </p>
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
              {allUsers.map(u => (
                <option key={u.id} value={u.id}>{uName(u)}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="flex-1 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Mégse</button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-1.5 text-xs text-white rounded-lg disabled:opacity-60 bg-orange-400 hover:bg-orange-500">
                {saving ? 'Mentés...' : 'Mentés'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className="font-medium text-gray-900 text-base">
              🧹 {week.assignedUser ? (week.assignedUser.nickname || week.assignedUser.firstName || week.assignedUser.name || week.assignedUser.email) : '—'}
            </p>
            {isAdmin && (
              <button onClick={() => setEditing(true)}
                className="text-xs text-orange-500 hover:text-orange-700 px-2 py-1 rounded-lg hover:bg-orange-50 transition-all">
                Módosítás
              </button>
            )}
          </div>
        )}
      </div>
      <div className="pt-2 border-t border-gray-100">
        <p className="text-xs text-gray-400 mb-2">Feladatok erre a hétre</p>
        <ul className="space-y-1 text-xs text-gray-600">
          <li>• Konyha tisztántartása (pult, asztal, csepegtető alatt törlés)</li>
          <li>• Ebéd után a mosogatógép elindítása, délután/másnap reggel kipakolása</li>
          <li>• Csepegtetőn lévő elmosott dolgok elpakolása</li>
          <li>• Mikró takarítása</li>
        </ul>
      </div>
    </div>
  )
}

function NewEventModal({ initialDate, onClose, onSaved }: {
  initialDate: string
  onClose: () => void
  onSaved: () => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(initialDate || new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (!title.trim()) { setError('A cím megadása kötelező'); return }
    setSaving(true)
    const r = await fetch('/api/calendar-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim(), description: description.trim() || null, date, type: 'EGYEB' }),
    })
    if (r.ok) {
      onSaved()
    } else {
      const d = await r.json()
      setError(d.error || 'Hiba történt')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">Új bejegyzés</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Dátum</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Cím *</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="pl. Csapattalálkozó"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Leírás (opcionális)</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50">Mégse</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2 text-sm font-medium text-white rounded-xl disabled:opacity-60"
            style={{ background: '#6C5CE7' }}>
            {saving ? 'Mentés...' : 'Mentés'}
          </button>
        </div>
      </div>
    </div>
  )
}

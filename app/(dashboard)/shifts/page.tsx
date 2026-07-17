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
  notes: string | null
  shopCode: string | null
  syncedAt: string
}

const MONTHS = ['Január', 'Február', 'Március', 'Április', 'Május', 'Június',
  'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December']
const DAYS = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V']

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export default function ShiftsPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [shifts, setShifts] = useState<ShiftDay[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ShiftDay | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)

  const loadShifts = useCallback(async () => {
    setLoading(true)
    const r = await fetch(`/api/shifts?year=${year}&month=${month}`)
    const d = await r.json()
    setShifts(d.shifts || [])
    setLoading(false)
  }, [year, month])

  useEffect(() => { loadShifts() }, [loadShifts])

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
    const r = await fetch('/api/cron/sync-shifts', {
      headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || ''}` },
    })
    const d = await r.json()
    if (r.ok) {
      setSyncResult(`✓ Szinkronizálva: ${d.upserted} szűrőnap`)
      loadShifts()
    } else {
      setSyncResult(`Hiba: ${d.error}`)
    }
    setSyncing(false)
  }

  // Build calendar grid
  const firstDay = new Date(year, month - 1, 1)
  const daysInMonth = new Date(year, month, 0).getDate()
  // Monday-based: 0=Mon … 6=Sun
  const startOffset = (firstDay.getDay() + 6) % 7
  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  function shiftsForDay(day: number) {
    const d = new Date(year, month - 1, day)
    return shifts.filter(s => isSameDay(new Date(s.date), d))
  }

  const upcomingShifts = shifts
    .filter(s => new Date(s.date) >= new Date(now.getFullYear(), now.getMonth(), now.getDate()))
    .slice(0, 5)

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Szűrőnapok naptára</h1>
          <p className="text-gray-500 text-sm mt-0.5">Google Sheets szinkronizáció alapján</p>
        </div>
        <button onClick={triggerSync} disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-xl disabled:opacity-60"
          style={{ background: '#6C5CE7' }}>
          <svg className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {syncing ? 'Szinkronizálás...' : 'Frissítés'}
        </button>
      </div>

      {syncResult && (
        <div className={`mb-4 px-4 py-3 rounded-xl text-sm ${syncResult.startsWith('✓') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {syncResult}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-base font-semibold text-gray-900">
              {MONTHS[month - 1]} {year}
            </h2>
            <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-7 mb-2">
            {DAYS.map(d => (
              <div key={d} className="text-center text-xs font-semibold text-gray-400 py-1">{d}</div>
            ))}
          </div>

          {loading ? (
            <div className="py-12 text-center text-gray-400 text-sm">Betöltés...</div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {cells.map((day, i) => {
                if (!day) return <div key={i} />
                const dayShifts = shiftsForDay(day)
                const isToday = isSameDay(new Date(year, month - 1, day), now)
                return (
                  <div
                    key={i}
                    className={`min-h-[64px] rounded-lg p-1 cursor-pointer border transition-all ${
                      isToday ? 'border-indigo-300 bg-indigo-50' : 'border-transparent hover:border-gray-200 hover:bg-gray-50'
                    }`}
                    onClick={() => dayShifts.length > 0 && setSelected(dayShifts[0])}
                  >
                    <p className={`text-xs font-medium text-right mb-1 ${isToday ? 'text-indigo-600' : 'text-gray-500'}`}>{day}</p>
                    {dayShifts.map(s => (
                      <div key={s.id} className="text-[10px] leading-tight rounded px-1 py-0.5 mb-0.5 text-white truncate"
                        style={{ background: '#6C5CE7' }}>
                        {s.location || s.shopName || '—'}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Sidebar: selected day detail or upcoming */}
        <div className="space-y-4">
          {selected ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900">Részletek</h3>
                <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <ShiftDetail shift={selected} />
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Következő szűrőnapok</h3>
              {upcomingShifts.length === 0 ? (
                <p className="text-sm text-gray-400">Nincs közelgő szűrőnap</p>
              ) : (
                <div className="space-y-3">
                  {upcomingShifts.map(s => (
                    <button key={s.id} onClick={() => setSelected(s)}
                      className="w-full text-left p-3 rounded-lg border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/50 transition-all">
                      <p className="text-xs text-gray-400 mb-0.5">
                        {new Date(s.date).toLocaleDateString('hu-HU', { month: 'long', day: 'numeric', weekday: 'short' })}
                        {s.timeStart && ` · ${s.timeStart}${s.timeEnd ? `–${s.timeEnd}` : ''}`}
                      </p>
                      <p className="text-sm font-medium text-gray-900 truncate">{s.shopName || s.location || '—'}</p>
                      {s.location && s.shopName && <p className="text-xs text-gray-500 truncate">{s.location}</p>}
                      {s.assignedTo && <p className="text-xs text-indigo-600 mt-0.5">{s.assignedTo}</p>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-xs text-gray-400">
            <p className="font-medium text-gray-500 mb-1">Szinkronizáció</p>
            {shifts.length > 0 ? (
              <p>Utoljára frissítve: {new Date(shifts[0].syncedAt).toLocaleString('hu-HU')}</p>
            ) : (
              <p>Még nem volt szinkronizáció</p>
            )}
            <p className="mt-1">{shifts.length} szűrőnap ebben a hónapban</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function ShiftDetail({ shift }: { shift: ShiftDay }) {
  const date = new Date(shift.date)
  return (
    <div className="space-y-3 text-sm">
      <div>
        <p className="text-xs text-gray-400 mb-0.5">Dátum</p>
        <p className="font-medium text-gray-900">
          {date.toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
        </p>
      </div>
      {(shift.timeStart || shift.timeEnd) && (
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Időpont</p>
          <p className="text-gray-900">{shift.timeStart}{shift.timeEnd ? ` – ${shift.timeEnd}` : ''}</p>
        </div>
      )}
      {shift.shopName && (
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Bolt neve</p>
          <p className="text-gray-900">{shift.shopName}</p>
        </div>
      )}
      {shift.location && (
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Helyszín</p>
          <p className="text-gray-900">{shift.location}</p>
        </div>
      )}
      {shift.address && (
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Cím</p>
          <p className="text-gray-900">{shift.address}</p>
        </div>
      )}
      {shift.assignedTo && (
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Ki megy</p>
          <p className="font-medium text-indigo-700">{shift.assignedTo}</p>
        </div>
      )}
      {shift.adMode && (
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Hirdetési mód</p>
          <p className="text-gray-900">{shift.adMode}</p>
        </div>
      )}
      {shift.contactPhone && (
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Telefon</p>
          <a href={`tel:${shift.contactPhone}`} className="text-indigo-600 hover:underline">{shift.contactPhone}</a>
        </div>
      )}
      {shift.contactEmail && (
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Email</p>
          <a href={`mailto:${shift.contactEmail}`} className="text-indigo-600 hover:underline truncate block">{shift.contactEmail}</a>
        </div>
      )}
      {shift.notes && (
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Megjegyzések</p>
          <p className="text-gray-700 text-xs leading-relaxed">{shift.notes}</p>
        </div>
      )}
      {shift.shopCode && (
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Boltkód</p>
          <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-mono">{shift.shopCode}</span>
        </div>
      )}
    </div>
  )
}

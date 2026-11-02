'use client'

import { useMemo, useState } from 'react'
import { COLUMN_LABELS, COLUMN_COLORS, type PrivateTask } from '@/lib/private-tasks'
import {
  localDayKey, taskDayKey, sortTasks, PRIORITY_LABELS, PRIORITY_COLORS,
  type DateBasis, type SortKey,
} from '@/lib/private-task-filters'

const WEEKDAYS = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V']
const MONTHS = [
  'január', 'február', 'március', 'április', 'május', 'június',
  'július', 'augusztus', 'szeptember', 'október', 'november', 'december',
]

type CalendarTask = PrivateTask & { archivedAt?: string | null }

/** The 42 cells (6 weeks) covering a month, starting on Monday. */
function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1)
  const offset = (first.getDay() + 6) % 7 // Monday = 0
  const start = new Date(year, month, 1 - offset)
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
}

/**
 * Month view of the already-filtered tasks.
 *
 * Which date places a card is asked here rather than in the filter bar: it is
 * a question only the calendar has. Anything with no such date can't sit on a
 * day, so it is listed under the grid rather than silently dropped — on the
 * deadline basis that is usually most of the board.
 */
export default function PrivateTaskCalendar({
  tasks,
  sort,
  onOpenTask,
}: {
  tasks: CalendarTask[]
  sort: SortKey
  onOpenTask: (task: CalendarTask) => void
}) {
  const today = new Date()
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selected, setSelected] = useState<string | null>(null)
  const [dateBasis, setDateBasis] = useState<DateBasis>('dueDate')

  const { byDay, undated } = useMemo(() => {
    const map = new Map<string, CalendarTask[]>()
    const none: CalendarTask[] = []
    // Inside a day the chosen ordering still applies; 'manual' has no meaning
    // here (there is no drag order on a calendar), so it falls back to deadline.
    const ordered = sortTasks(tasks, sort === 'manual' ? 'dueDate' : sort)
    for (const t of ordered) {
      const key = taskDayKey(t, dateBasis)
      if (!key) { none.push(t); continue }
      const list = map.get(key)
      if (list) list.push(t)
      else map.set(key, [t])
    }
    return { byDay: map, undated: none }
  }, [tasks, dateBasis, sort])

  const grid = useMemo(() => monthGrid(cursor.getFullYear(), cursor.getMonth()), [cursor])
  const todayKey = localDayKey(today)
  const selectedTasks = selected ? (byDay.get(selected) ?? []) : []

  function shiftMonth(delta: number) {
    setCursor(c => new Date(c.getFullYear(), c.getMonth() + delta, 1))
    setSelected(null)
  }

  return (
    <div className="flex-1 min-w-0">
      <div className="bg-white rounded-xl border border-gray-100 p-3 sm:p-4">
        <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-sm sm:text-base font-semibold text-gray-900">
              {cursor.getFullYear()}. {MONTHS[cursor.getMonth()]}
            </h2>
            {/* Which date a card is placed on — only meaningful here. */}
            <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden">
              {(['dueDate', 'createdAt'] as DateBasis[]).map(b => (
                <button key={b} type="button" onClick={() => setDateBasis(b)}
                  className={`px-2.5 py-1 text-xs transition-colors ${
                    dateBasis === b ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-500 hover:bg-gray-50'
                  }`}>
                  {b === 'dueDate' ? 'Határidő' : 'Létrehozás'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => shiftMonth(-1)} aria-label="Előző hónap"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button onClick={() => { setCursor(new Date(today.getFullYear(), today.getMonth(), 1)); setSelected(todayKey) }}
              className="px-2.5 h-8 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 border border-gray-200">
              Ma
            </button>
            <button onClick={() => shiftMonth(1)} aria-label="Következő hónap"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAYS.map(d => (
            <div key={d} className="text-center text-[11px] font-semibold uppercase tracking-wide text-gray-400 py-1">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {grid.map(day => {
            const key = localDayKey(day)
            const inMonth = day.getMonth() === cursor.getMonth()
            const list = byDay.get(key) ?? []
            const isToday = key === todayKey
            const isSelected = key === selected
            return (
              <button
                key={key}
                onClick={() => setSelected(isSelected ? null : key)}
                className={`min-h-16 sm:min-h-24 p-1 sm:p-1.5 rounded-lg border text-left align-top transition-colors ${
                  isSelected ? 'border-indigo-400 bg-indigo-50'
                  : isToday ? 'border-indigo-200 bg-white'
                  : 'border-gray-100 bg-white hover:bg-gray-50'
                } ${inMonth ? '' : 'opacity-40'}`}
              >
                <span className={`inline-flex items-center justify-center w-5 h-5 text-[11px] rounded-full ${
                  isToday ? 'bg-indigo-600 text-white font-semibold' : 'text-gray-500'
                }`}>
                  {day.getDate()}
                </span>
                <div className="mt-0.5 space-y-0.5">
                  {list.slice(0, 2).map(t => (
                    <div key={t.id}
                      className="flex items-center gap-1 px-1 py-0.5 rounded bg-gray-50 border-l-2"
                      style={{ borderLeftColor: PRIORITY_COLORS[t.priority] ?? '#9CA3AF' }}>
                      <span className="text-[10px] leading-tight text-gray-700 truncate">{t.title}</span>
                    </div>
                  ))}
                  {list.length > 2 && (
                    <span className="block text-[10px] text-gray-400 px-1">+{list.length - 2} további</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {selected && (
        <div className="bg-white rounded-xl border border-gray-100 p-4 mt-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            {selected.slice(8, 10).replace(/^0/, '')}. {MONTHS[Number(selected.slice(5, 7)) - 1]} —{' '}
            {selectedTasks.length} feladat
          </h3>
          {selectedTasks.length === 0 ? (
            <p className="text-sm text-gray-400">Ezen a napon nincs feladat.</p>
          ) : (
            <div className="space-y-2">
              {selectedTasks.map(t => <TaskRow key={t.id} task={t} onOpen={onOpenTask} />)}
            </div>
          )}
        </div>
      )}

      {undated.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-4 mt-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">
            {dateBasis === 'dueDate' ? 'Határidő nélkül' : 'Létrehozás dátuma nélkül'} — {undated.length} feladat
          </h3>
          <p className="text-xs text-gray-400 mb-3">
            Ezek nem kerülnek egy adott napra, ezért a naptár alatt szerepelnek.
          </p>
          <div className="space-y-2">
            {undated.map(t => <TaskRow key={t.id} task={t} onOpen={onOpenTask} />)}
          </div>
        </div>
      )}
    </div>
  )
}

function TaskRow({ task, onOpen }: { task: CalendarTask; onOpen: (t: CalendarTask) => void }) {
  return (
    <button onClick={() => onOpen(task)}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border border-gray-100 hover:bg-gray-50 text-left">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: PRIORITY_COLORS[task.priority] ?? '#9CA3AF' }} />
      <span className="text-sm text-gray-800 min-w-0 truncate flex-1">{task.title}</span>
      {task.archivedAt && (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 shrink-0">Archivált</span>
      )}
      <span className="text-[10px] px-1.5 py-0.5 rounded text-white shrink-0"
        style={{ background: COLUMN_COLORS[task.column] }}>
        {COLUMN_LABELS[task.column]}
      </span>
      <span className="text-[11px] text-gray-400 shrink-0 hidden sm:inline">{PRIORITY_LABELS[task.priority]}</span>
    </button>
  )
}

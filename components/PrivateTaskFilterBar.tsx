'use client'

import MultiSelectFilter from './MultiSelectFilter'
import { PRIVATE_TASK_COLUMNS, COLUMN_LABELS, COLUMN_COLORS } from '@/lib/private-tasks'
import {
  EMPTY_FILTERS, isFilterActive, periodBasis,
  PRIORITY_ORDER, PRIORITY_LABELS, PRIORITY_COLORS,
  type PrivateTaskFilters, type Period, type SortKey,
} from '@/lib/private-task-filters'

const SORTS: { value: SortKey; label: string }[] = [
  { value: 'manual', label: 'Kézi sorrend' },
  { value: 'dueDate', label: 'Határidő szerint' },
  { value: 'createdAt', label: 'Létrehozás szerint' },
  { value: 'priority', label: 'Prioritás szerint' },
]

export default function PrivateTaskFilterBar({
  filters,
  onChange,
  matchCount,
  totalCount,
}: {
  filters: PrivateTaskFilters
  onChange: (next: PrivateTaskFilters) => void
  matchCount: number
  totalCount: number
}) {
  const set = <K extends keyof PrivateTaskFilters>(key: K, v: PrivateTaskFilters[K]) =>
    onChange({ ...filters, [key]: v })

  const active = isFilterActive(filters)
  const isCustom = filters.period.endsWith(':custom')
  const basis = periodBasis(filters.period)

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-3 mb-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <label className="flex items-center gap-2 text-sm text-gray-500">
          <span className="whitespace-nowrap">Rendezés</span>
          <select value={filters.sort} onChange={e => set('sort', e.target.value as SortKey)}
            className={`px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:border-indigo-400 ${
              filters.sort !== 'manual' ? 'border-indigo-300 text-gray-800' : 'border-gray-200 text-gray-600'
            }`}>
            {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>

        {/* The period names its own date field, so there is no separate toggle
            to read it against. */}
        <select value={filters.period} onChange={e => set('period', e.target.value as Period)}
          className={`px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:border-indigo-400 ${
            filters.period !== 'all' ? 'border-indigo-300 text-gray-800' : 'border-gray-200 text-gray-600'
          }`}>
          <option value="all">Minden időszak</option>
          <optgroup label="Határidő szerint">
            <option value="due:today">Határidő: ma</option>
            <option value="due:week">Határidő: ezen a héten</option>
            <option value="due:month">Határidő: ebben a hónapban</option>
            <option value="due:custom">Határidő: egyéni időszak</option>
          </optgroup>
          <optgroup label="Létrehozás szerint">
            <option value="created:today">Létrehozva: ma</option>
            <option value="created:week">Létrehozva: ezen a héten</option>
            <option value="created:month">Létrehozva: ebben a hónapban</option>
            <option value="created:custom">Létrehozva: egyéni időszak</option>
          </optgroup>
        </select>

        {isCustom && (
          <div className="flex items-center gap-1.5">
            <input type="date" value={filters.from} onChange={e => set('from', e.target.value)}
              className="px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400" />
            <span className="text-gray-400 text-sm">–</span>
            <input type="date" value={filters.to} onChange={e => set('to', e.target.value)}
              className="px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400" />
          </div>
        )}

        <MultiSelectFilter
          options={PRIORITY_ORDER.map(p => ({ value: p, label: PRIORITY_LABELS[p], dot: PRIORITY_COLORS[p] }))}
          value={filters.priorities}
          onChange={v => set('priorities', v)}
          allLabel="Minden prioritás" unitLabel="prioritás" clearLabel="Prioritásszűrő törlése"
        />

        <MultiSelectFilter
          options={PRIVATE_TASK_COLUMNS.map(c => ({ value: c, label: COLUMN_LABELS[c], dot: COLUMN_COLORS[c] }))}
          value={filters.columns}
          onChange={v => set('columns', v)}
          allLabel="Minden állapot" unitLabel="állapot" clearLabel="Állapotszűrő törlése"
        />

        <label className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 cursor-pointer hover:border-gray-300">
          <input type="checkbox" checked={filters.includeArchived}
            onChange={e => set('includeArchived', e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 accent-indigo-600 cursor-pointer" />
          <span className="whitespace-nowrap">Archívum is</span>
        </label>

        {active && (
          <button type="button" onClick={() => onChange(EMPTY_FILTERS)}
            className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50">
            Szűrők törlése
          </button>
        )}
      </div>

      {active && (
        <p className="text-xs text-gray-500 mt-2.5">
          {matchCount} feladat látszik a(z) {totalCount} közül.
          {basis === 'dueDate' && (
            <span className="text-gray-400"> A határidő nélküli feladatok ilyenkor nem jelennek meg.</span>
          )}
          {filters.sort !== 'manual' && (
            <span className="text-gray-400"> A kézi sorrend átmenetileg nem érvényes; áthúzni viszont továbbra is lehet más állapotba.</span>
          )}
        </p>
      )}
    </div>
  )
}

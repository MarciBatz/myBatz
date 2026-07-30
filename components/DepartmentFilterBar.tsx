'use client'

import { badgeColors, COMPANY_WIDE_LABEL, COMPANY_WIDE_COLOR } from '@/lib/departments'

export interface SelectableDepartment {
  id: string
  name: string
  color: string
}

/**
 * Department scope selector shown above the ticket list and the dashboard.
 *
 * Company-wide tickets are deliberately not togglable — they're always in view,
 * and the bar says so, so an empty-looking list is never a mystery. On mobile the
 * chips become a horizontally scrollable row, matching the private-task board's
 * existing mobile filter pattern.
 */
export default function DepartmentFilterBar({
  departments,
  selectedIds,
  onChange,
}: {
  departments: SelectableDepartment[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
}) {
  // Nothing to choose between — don't take up space with a one-option filter.
  if (departments.length === 0) return null

  const allSelected = selectedIds.length === 0 || selectedIds.length === departments.length
  const selected = new Set(selectedIds)

  function toggle(id: string) {
    // Coming from "all", a click means "only this one" rather than "all except".
    if (allSelected) {
      onChange([id])
      return
    }
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    // Deselecting the last one falls back to everything instead of showing nothing.
    onChange(next.size === 0 ? [] : Array.from(next))
  }

  const activeNames = allSelected
    ? 'Minden részleg'
    : departments.filter(d => selected.has(d.id)).map(d => d.name).join(', ')

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 mb-4">
      <div className="flex items-start gap-2 flex-wrap">
        <span className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold pt-1.5 shrink-0">
          Részleg
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0 sm:flex-wrap">
            <button
              onClick={() => onChange([])}
              className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                allSelected
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  : 'text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              Minden részleg
            </button>

            {departments.map(d => {
              const on = !allSelected && selected.has(d.id)
              const c = badgeColors(d.color)
              return (
                <button
                  key={d.id}
                  onClick={() => toggle(d.id)}
                  className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    on ? '' : 'text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                  style={on ? { background: c.background, color: c.text, borderColor: c.background } : undefined}
                >
                  {d.name}
                </button>
              )
            })}

            {/* Always-on, never a toggle — shown so the rule is visible, not implied. */}
            <span
              className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border border-dashed"
              style={{ color: COMPANY_WIDE_COLOR, borderColor: COMPANY_WIDE_COLOR }}
              title="A teljes céges feladatok minden szűrés mellett látszanak"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {COMPANY_WIDE_LABEL}
            </span>
          </div>

          <p className="text-[11px] text-gray-400 mt-1.5">
            Most ezt látod: <span className="text-gray-600 font-medium">{activeNames}</span>
            {' · '}a <span style={{ color: COMPANY_WIDE_COLOR }} className="font-medium">{COMPANY_WIDE_LABEL}</span> feladatok mindig megjelennek.
          </p>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'

const STATUSES: { value: string; label: string; dot: string }[] = [
  { value: 'OPEN', label: 'Nyitott', dot: '#3B82F6' },
  { value: 'IN_PROGRESS', label: 'Folyamatban', dot: '#6C5CE7' },
  { value: 'AWAITING', label: 'Várakozó', dot: '#F59E0B' },
  { value: 'CLOSED', label: 'Lezárt', dot: '#6B7280' },
]

/**
 * Status filter that accepts several statuses at once.
 *
 * A native <select multiple> would need ctrl/cmd-clicking to combine values and
 * is close to unusable on a phone, so this is a plain dropdown of checkboxes
 * styled to sit in the same row as the other filters. An empty selection means
 * "all", which is what the trigger says.
 */
export default function StatusFilter({
  value,
  onChange,
}: {
  value: string[]
  onChange: (next: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const selected = STATUSES.filter(s => value.includes(s.value))
  const label =
    selected.length === 0 ? 'Minden státusz'
    : selected.length === 1 ? selected[0].label
    : `${selected.length} státusz`

  function toggle(status: string) {
    onChange(value.includes(status) ? value.filter(v => v !== status) : [...value, status])
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm bg-white transition-colors ${
          selected.length > 0
            ? 'border-indigo-300 text-gray-800'
            : 'border-gray-200 text-gray-600 hover:border-gray-300'
        }`}
      >
        <span>{label}</span>
        <svg className={`w-3.5 h-3.5 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div role="listbox" aria-multiselectable
          className="absolute z-30 mt-1 min-w-52 bg-white border border-gray-200 rounded-xl shadow-lg p-1.5">
          {STATUSES.map(s => {
            const on = value.includes(s.value)
            return (
              <label key={s.value}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" checked={on} onChange={() => toggle(s.value)}
                  className="w-4 h-4 rounded border-gray-300 accent-indigo-600 cursor-pointer" />
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.dot }} />
                <span>{s.label}</span>
              </label>
            )
          })}
          {selected.length > 0 && (
            <button type="button" onClick={() => onChange([])}
              className="w-full text-left px-2.5 py-2 mt-1 border-t border-gray-100 text-xs text-gray-500 hover:text-gray-700">
              Státuszszűrő törlése
            </button>
          )}
        </div>
      )}
    </div>
  )
}

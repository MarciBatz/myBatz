'use client'

import { useEffect, useRef, useState } from 'react'

export interface MultiSelectOption {
  value: string
  label: string
  /** Optional colour dot, so the list reads the same way the cards do. */
  dot?: string
}

/**
 * Dropdown of checkboxes for filtering by several values at once.
 *
 * A native <select multiple> needs ctrl/cmd-clicking to combine values and is
 * close to unusable on a phone, so this is a plain popover styled to sit in a
 * row of filters. An empty selection means "all", which is what the trigger
 * says.
 */
export default function MultiSelectFilter({
  options,
  value,
  onChange,
  allLabel,
  unitLabel,
  clearLabel,
}: {
  options: MultiSelectOption[]
  value: string[]
  onChange: (next: string[]) => void
  /** Shown when nothing is picked, e.g. "Minden prioritás". */
  allLabel: string
  /** Counted noun for 2+ selections, e.g. "prioritás" → "2 prioritás". */
  unitLabel: string
  clearLabel: string
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

  const selected = options.filter(o => value.includes(o.value))
  const label =
    selected.length === 0 ? allLabel
    : selected.length === 1 ? selected[0].label
    : `${selected.length} ${unitLabel}`

  function toggle(v: string) {
    onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v])
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
        <span className="whitespace-nowrap">{label}</span>
        <svg className={`w-3.5 h-3.5 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div role="listbox" aria-multiselectable
          className="absolute z-30 mt-1 min-w-52 bg-white border border-gray-200 rounded-xl shadow-lg p-1.5">
          {options.map(o => (
            <label key={o.value}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">
              <input type="checkbox" checked={value.includes(o.value)} onChange={() => toggle(o.value)}
                className="w-4 h-4 rounded border-gray-300 accent-indigo-600 cursor-pointer" />
              {o.dot && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: o.dot }} />}
              <span className="whitespace-nowrap">{o.label}</span>
            </label>
          ))}
          {selected.length > 0 && (
            <button type="button" onClick={() => onChange([])}
              className="w-full text-left px-2.5 py-2 mt-1 border-t border-gray-100 text-xs text-gray-500 hover:text-gray-700">
              {clearLabel}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { badgeColors } from '@/lib/departments'

interface AdminDepartment {
  id: string
  name: string
  color: string
  _count?: { members: number; tickets: number }
}

/** A small palette that fits the myBatz look; a free colour picker is also offered. */
const PRESET_COLORS = [
  '#6C5CE7', '#0F766E', '#DC2626', '#EA580C',
  '#CA8A04', '#16A34A', '#0284C7', '#7C3AED',
  '#DB2777', '#475569',
]

/**
 * Department administration — ADMIN only. Deletion is guarded server-side when
 * users or tickets are attached; the error from that check is shown verbatim.
 */
export default function DepartmentsSection() {
  const [departments, setDepartments] = useState<AdminDepartment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(PRESET_COLORS[0])
  const [creating, setCreating] = useState(false)

  const [editing, setEditing] = useState<{ id: string; name: string; color: string } | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AdminDepartment | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(() => {
    // Chained rather than awaited so the state updates happen in a callback,
    // not synchronously inside the effect body.
    fetch('/api/departments')
      .then(r => r.json())
      .then(d => { setDepartments(d.all || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim() || creating) return
    setCreating(true)
    setError('')
    const res = await fetch('/api/departments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), color: newColor }),
    })
    setCreating(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Nem sikerült létrehozni a részleget.')
      return
    }
    setNewName('')
    setNewColor(PRESET_COLORS[0])
    load()
  }

  async function saveEdit() {
    if (!editing || savingEdit) return
    setSavingEdit(true)
    setError('')
    const res = await fetch(`/api/departments/${editing.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editing.name.trim(), color: editing.color }),
    })
    setSavingEdit(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Nem sikerült módosítani a részleget.')
      return
    }
    setEditing(null)
    load()
  }

  async function confirmDelete() {
    if (!deleteTarget || deleting) return
    setDeleting(true)
    setError('')
    const res = await fetch(`/api/departments/${deleteTarget.id}`, { method: 'DELETE' })
    setDeleting(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Nem sikerült törölni a részleget.')
      setDeleteTarget(null)
      return
    }
    setDeleteTarget(null)
    load()
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Részlegek</h2>
      <p className="text-sm text-gray-500 mb-4">
        A publikus feladatok részleghez tartoznak. A felhasználók csak a saját részlegeik
        feladatait látják — a „Teljes cég” láthatóságú feladatokat viszont mindenki.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">{error}</div>
      )}

      <form onSubmit={create} className="mb-5 space-y-2">
        <div className="flex gap-2">
          <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400"
            placeholder="Új részleg neve" />
          <button type="submit" disabled={creating || !newName.trim()}
            className="px-4 py-2 text-sm text-white font-medium rounded-xl disabled:opacity-60 shrink-0"
            style={{ background: '#6C5CE7' }}>
            {creating ? 'Létrehozás...' : 'Hozzáad'}
          </button>
        </div>
        <ColorPicker value={newColor} onChange={setNewColor} label="Szín" />
      </form>

      {loading ? (
        <p className="text-sm text-gray-400 py-2">Betöltés…</p>
      ) : departments.length === 0 ? (
        <p className="text-sm text-gray-400 py-2">Még nincs részleg</p>
      ) : (
        <div className="space-y-2">
          {departments.map(d => (
            <div key={d.id} className="border border-gray-100 rounded-xl p-3">
              {editing?.id === d.id ? (
                <div className="space-y-2">
                  <input type="text" value={editing.name}
                    onChange={e => setEditing({ ...editing, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400" />
                  <ColorPicker value={editing.color} onChange={c => setEditing({ ...editing, color: c })} label="Szín" />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setEditing(null)}
                      className="px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Mégse</button>
                    <button onClick={saveEdit} disabled={savingEdit || !editing.name.trim()}
                      className="px-3 py-1.5 text-xs text-white font-medium rounded-lg disabled:opacity-60"
                      style={{ background: '#6C5CE7' }}>
                      {savingEdit ? 'Mentés...' : 'Mentés'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="px-2.5 py-1 rounded-md text-xs font-medium shrink-0"
                    style={{ background: badgeColors(d.color).background, color: badgeColors(d.color).text }}>
                    {d.name}
                  </span>
                  <span className="text-xs text-gray-400 flex-1 min-w-0 truncate">
                    {d._count?.members ?? 0} felhasználó · {d._count?.tickets ?? 0} feladat
                  </span>
                  <button onClick={() => setEditing({ id: d.id, name: d.name, color: d.color })}
                    className="text-xs text-gray-500 hover:text-indigo-600 px-2 py-1 shrink-0">Szerkesztés</button>
                  <button onClick={() => setDeleteTarget(d)}
                    className="text-xs text-red-400 hover:text-red-600 px-2 py-1 shrink-0">Törlés</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="p-5">
              <h3 className="font-semibold text-gray-900 mb-2">Részleg törlése</h3>
              <p className="text-sm text-gray-600">
                Biztosan törlöd a(z) <span className="font-medium text-gray-800">„{deleteTarget.name}”</span> részleget?
                {(deleteTarget._count?.members || deleteTarget._count?.tickets)
                  ? ' Ehhez a részleghez még tartoznak felhasználók vagy feladatok, ezért a törlés valószínűleg nem fog sikerülni.'
                  : ' Ez nem vonható vissza.'}
              </p>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Mégse</button>
              <button onClick={confirmDelete} disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-white rounded-lg bg-red-500 hover:bg-red-600 disabled:opacity-60">
                {deleting ? 'Törlés...' : 'Törlés'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ColorPicker({ value, onChange, label }: { value: string; onChange: (c: string) => void; label: string }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-gray-500">{label}</span>
      {PRESET_COLORS.map(c => (
        <button key={c} type="button" onClick={() => onChange(c)}
          title={c}
          className={`w-6 h-6 rounded-md border-2 transition-transform ${value.toLowerCase() === c.toLowerCase() ? 'scale-110 border-gray-700' : 'border-transparent hover:scale-105'}`}
          style={{ background: c }}
        />
      ))}
      {/* Free choice for anything outside the palette; contrast is derived automatically. */}
      <input type="color" value={value} onChange={e => onChange(e.target.value)}
        title="Egyéni szín"
        className="w-6 h-6 rounded-md border border-gray-200 bg-transparent cursor-pointer p-0" />
      <span className="text-xs px-2 py-0.5 rounded-md"
        style={{ background: badgeColors(value).background, color: badgeColors(value).text }}>
        Előnézet
      </span>
    </div>
  )
}

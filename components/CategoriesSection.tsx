'use client'

import { useState, useEffect, useCallback } from 'react'
import { badgeColors, type DepartmentSummary } from '@/lib/departments'

interface Category {
  id: string
  name: string
  departmentId: string
  department: { id: string; name: string; color: string }
  _count?: { tickets: number }
}

/**
 * Per-department category administration.
 *
 * The server decides which departments this user may curate (the
 * canManageCategories permission *and* membership); this only renders what it
 * was given, and the endpoints re-check on every write.
 */
export default function CategoriesSection() {
  const [categories, setCategories] = useState<Category[]>([])
  const [manageable, setManageable] = useState<DepartmentSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [newName, setNewName] = useState('')
  const [newDepartmentId, setNewDepartmentId] = useState('')
  const [creating, setCreating] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(() => {
    fetch('/api/categories')
      .then(r => r.json())
      .then(d => {
        setCategories(d.categories || [])
        setManageable(d.manageableDepartments || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  // Derived, not synced into state: with exactly one manageable department there
  // is nothing to choose, so it is simply the target.
  const targetDepartmentId = manageable.length === 1 ? manageable[0].id : newDepartmentId

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim() || !targetDepartmentId || creating) return
    setCreating(true)
    setError('')
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), departmentId: targetDepartmentId }),
    })
    setCreating(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Nem sikerült létrehozni a kategóriát')
      return
    }
    setNewName('')
    load()
  }

  async function confirmDelete() {
    if (!deleteTarget || deleting) return
    setDeleting(true)
    setError('')
    const res = await fetch(`/api/categories/${deleteTarget.id}`, { method: 'DELETE' })
    setDeleting(false)
    setDeleteTarget(null)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Nem sikerült törölni a kategóriát')
      return
    }
    load()
  }

  if (loading) return null
  // Nothing to curate and nothing to show: stay out of the way entirely.
  if (manageable.length === 0 && categories.length === 0) return null

  // Group by department so it's obvious the lists are separate, not one pool.
  const byDepartment = new Map<string, { department: Category['department']; items: Category[] }>()
  for (const d of manageable) {
    byDepartment.set(d.id, { department: { id: d.id, name: d.name, color: d.color }, items: [] })
  }
  for (const c of categories) {
    const entry = byDepartment.get(c.departmentId)
    if (entry) entry.items.push(c)
    else byDepartment.set(c.departmentId, { department: c.department, items: [c] })
  }
  const groups = [...byDepartment.values()].sort((a, b) => a.department.name.localeCompare(b.department.name, 'hu'))

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
      <h2 className="text-lg font-semibold text-gray-900">Kategóriák</h2>
      <p className="text-sm text-gray-500 mt-0.5 mb-4">
        Minden részlegnek saját kategórialistája van. Csak azokhoz a részlegekhez tudsz kategóriát
        felvenni, amelyeknek tagja vagy.
      </p>

      {manageable.length > 0 && (
        <form onSubmit={create} className="flex flex-col sm:flex-row gap-3 mb-5">
          {manageable.length > 1 && (
            <select value={newDepartmentId} onChange={e => setNewDepartmentId(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-indigo-400">
              <option value="">— Válassz részleget —</option>
              {manageable.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}
          <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400"
            placeholder={manageable.length === 1
              ? `Új kategória a(z) ${manageable[0].name} részlegnek`
              : 'Új kategória neve'} />
          <button type="submit" disabled={creating || !newName.trim() || !targetDepartmentId}
            className="px-4 py-2 text-sm text-white font-medium rounded-xl disabled:opacity-60"
            style={{ background: '#6C5CE7' }}>
            {creating ? 'Hozzáadás...' : 'Hozzáad'}
          </button>
        </form>
      )}

      {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

      <div className="space-y-5">
        {groups.map(({ department, items }) => {
          const c = badgeColors(department.color)
          const canManage = manageable.some(d => d.id === department.id)
          return (
            <div key={department.id}>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 rounded-md text-xs font-medium"
                  style={{ background: c.background, color: c.text }}>
                  {department.name}
                </span>
                <span className="text-xs text-gray-400">{items.length} kategória</span>
              </div>
              {items.length === 0 ? (
                <p className="text-sm text-gray-400 pl-1">Ehhez a részleghez még nincs kategória</p>
              ) : (
                <div className="space-y-1.5">
                  {items.map(cat => (
                    <div key={cat.id} className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg hover:bg-gray-50">
                      <span className="text-sm text-gray-700 min-w-0 truncate">{cat.name}</span>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-gray-400">{cat._count?.tickets ?? 0} feladat</span>
                        {canManage && (
                          <button onClick={() => setDeleteTarget(cat)}
                            className="text-xs text-red-400 hover:text-red-600">Törlés</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Deleting a category doesn't delete tickets — it detaches from them, so
          the count is shown rather than the deletion being blocked. */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Kategória törlése</h3>
            <p className="text-sm text-gray-600 mb-5">
              Biztosan törlöd a(z) <strong>{deleteTarget.name}</strong> kategóriát a(z){' '}
              <strong>{deleteTarget.department.name}</strong> részlegből?
              {(deleteTarget._count?.tickets ?? 0) > 0 && (
                <span className="block mt-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  {deleteTarget._count?.tickets} feladatról lekerül a kategória. A feladatok megmaradnak.
                </span>
              )}
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">Mégse</button>
              <button onClick={confirmDelete} disabled={deleting}
                className="px-4 py-2 text-sm text-white font-medium rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-60">
                {deleting ? 'Törlés...' : 'Törlés'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

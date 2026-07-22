'use client'

import { useState, useEffect } from 'react'
import SavedRepliesSection from '@/components/SavedRepliesSection'

interface Category { id: string; name: string }

export default function SettingsPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [newCategory, setNewCategory] = useState('')
  const [addingCategory, setAddingCategory] = useState(false)

  const [profile, setProfile] = useState({ lastName: '', firstName: '', nickname: '', avatarUrl: '' })
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [profileError, setProfileError] = useState('')
  const [profileSuccess, setProfileSuccess] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  const [currentUser, setCurrentUser] = useState<{ id: string; role: string } | null>(null)
  const [canManageCategories, setCanManageCategories] = useState(false)

  useEffect(() => {
    loadCategories()
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      setCurrentUser(d.user)
      const u = d.user || {}
      setProfile({
        lastName: u.lastName || '',
        firstName: u.firstName || '',
        nickname: u.nickname || '',
        avatarUrl: u.avatarUrl || '',
      })
      if (u.role === 'ADMIN') {
        setCanManageCategories(true)
      } else if (u.id) {
        fetch(`/api/users/${u.id}/settings`).then(r => r.json()).then(s => {
          setCanManageCategories(s.permissions?.canManageCategories === true)
        })
      }
    })
  }, [])

  async function loadCategories() {
    const r = await fetch('/api/categories')
    const d = await r.json()
    setCategories(d.categories || [])
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault()
    if (!newCategory.trim()) return
    setAddingCategory(true)
    await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newCategory }),
    })
    setNewCategory('')
    setAddingCategory(false)
    loadCategories()
  }

  async function deleteCategory(id: string) {
    if (!confirm('Biztosan törlöd ezt a kategóriát?')) return
    await fetch(`/api/categories/${id}`, { method: 'DELETE' })
    loadCategories()
  }

  // Split into two forms/handlers — not just for the "Profil mentése" vs.
  // "Jelszó módosítása" UX, but because a text field sharing a <form> with
  // password inputs is exactly the shape Chrome's account-suggestion popup
  // looks for. A nonstandard autocomplete token on Avatar URL wasn't enough
  // to stop it — Chrome's own field classifier still won by proximity. With
  // no password field anywhere in this form, there's nothing for it to key off.
  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setProfileError('')
    setProfileSuccess('')
    setSavingProfile(true)

    const name = [profile.lastName, profile.firstName].filter(Boolean).join(' ')
    const body: Record<string, string> = {
      name,
      lastName: profile.lastName,
      firstName: profile.firstName,
      nickname: profile.nickname,
    }
    if (profile.avatarUrl) body.avatarUrl = profile.avatarUrl

    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) {
      setProfileError(data.error || 'Mentés sikertelen')
    } else {
      setProfileSuccess('Profil sikeresen mentve')
    }
    setSavingProfile(false)
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')

    if (newPassword !== confirmPassword) {
      setPasswordError('A két jelszó nem egyezik meg')
      return
    }

    setSavingPassword(true)
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    })
    const data = await res.json()
    if (!res.ok) {
      setPasswordError(data.error || 'Mentés sikertelen')
    } else {
      setPasswordSuccess('Jelszó megváltoztatva')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    }
    setSavingPassword(false)
  }

  const isAdmin = currentUser?.role === 'ADMIN'

  const previewName = profile.nickname || profile.firstName || profile.lastName || '—'

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Beállítások</h1>
        <p className="text-gray-500 text-sm mt-0.5">Fiók és munkaterület kezelése</p>
      </div>

      <div className="space-y-6">
        {/* Profile */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Profil</h2>
          <form onSubmit={saveProfile} className="space-y-4">
            {profileError && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{profileError}</div>}
            {profileSuccess && <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm">{profileSuccess}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Vezetéknév</label>
                <input type="text" autoComplete="family-name" value={profile.lastName} onChange={e => setProfile(p => ({ ...p, lastName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400"
                  placeholder="Nagy" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Keresztnév</label>
                <input type="text" autoComplete="given-name" value={profile.firstName} onChange={e => setProfile(p => ({ ...p, firstName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400"
                  placeholder="Béla" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Becenév
                  <span className="ml-1.5 text-xs text-gray-400 font-normal">ha megadod, mindenhol ez jelenik meg</span>
                </label>
                <input type="text" autoComplete="nickname" value={profile.nickname} onChange={e => setProfile(p => ({ ...p, nickname: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400"
                  placeholder="pl. Béci" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Avatar URL (kép link)</label>
                <input type="url" autoComplete="off" value={profile.avatarUrl} onChange={e => setProfile(p => ({ ...p, avatarUrl: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400"
                  placeholder="https://..." />
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm text-gray-600 flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 overflow-hidden" style={{ background: '#6C5CE7' }}>
                  {profile.avatarUrl ? (
                    <img src={profile.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    (profile.nickname || profile.firstName || profile.lastName || '?')[0].toUpperCase()
                  )}
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">{previewName}</p>
                  <p className="text-xs text-gray-400">profilkép előnézet</p>
                </div>
              </div>
              <span className="text-gray-400">·</span>
              <span>A rendszer így szólít meg: <strong className="text-gray-900">Szia, {previewName}!</strong></span>
            </div>

            <div className="flex justify-end">
              <button type="submit" disabled={savingProfile}
                className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-60"
                style={{ background: '#6C5CE7' }}>
                {savingProfile ? 'Mentés...' : 'Profil mentése'}
              </button>
            </div>
          </form>
        </div>

        {/* Password — a separate <form>, deliberately with no other fields in
            it, so nothing here looks like a username Chrome could pair with
            these password fields. */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Jelszó módosítása</h2>
          <form onSubmit={savePassword} className="space-y-4">
            {passwordError && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{passwordError}</div>}
            {passwordSuccess && <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm">{passwordSuccess}</div>}
            <div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Jelenlegi jelszó</label>
                  <input type="password" autoComplete="current-password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Új jelszó</label>
                  <input type="password" autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Új jelszó megerősítése</label>
                  <input type="password" autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400" />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button type="submit" disabled={savingPassword}
                className="px-4 py-2 text-sm text-white font-medium rounded-xl disabled:opacity-60"
                style={{ background: '#6C5CE7' }}>
                {savingPassword ? 'Mentés...' : 'Jelszó módosítása'}
              </button>
            </div>
          </form>
        </div>

        {/* Saved replies */}
        <SavedRepliesSection />

        {/* Categories */}
        {canManageCategories && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Kategóriák</h2>
            <form onSubmit={addCategory} className="flex gap-3 mb-4">
              <input type="text" value={newCategory} onChange={e => setNewCategory(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400"
                placeholder="Új kategória neve" />
              <button type="submit" disabled={addingCategory || !newCategory.trim()}
                className="px-4 py-2 text-sm text-white font-medium rounded-xl disabled:opacity-60"
                style={{ background: '#6C5CE7' }}>
                Hozzáad
              </button>
            </form>
            <div className="space-y-2">
              {categories.map(c => (
                <div key={c.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50">
                  <span className="text-sm text-gray-700">{c.name}</span>
                  <button onClick={() => deleteCategory(c.id)} className="text-xs text-red-400 hover:text-red-600">Törlés</button>
                </div>
              ))}
              {categories.length === 0 && <p className="text-sm text-gray-400 py-2">Még nincs kategória</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

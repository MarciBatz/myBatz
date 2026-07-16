'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'

export default function InvitePage() {
  const router = useRouter()
  const params = useParams()
  const token = params.token as string

  const [name, setName] = useState<string | null>(null)
  const [valid, setValid] = useState<boolean | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch(`/api/invite/${token}`)
      .then(r => r.json())
      .then(d => {
        setValid(d.valid)
        if (d.name) setName(d.name)
      })
      .catch(() => setValid(false))
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('A két jelszó nem egyezik meg'); return }
    if (password.length < 8) { setError('A jelszónak legalább 8 karakter hosszúnak kell lennie'); return }
    setError('')
    setLoading(true)

    try {
      const res = await fetch(`/api/invite/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Aktiválás sikertelen'); return }
      router.push('/dashboard')
    } catch {
      setError('Váratlan hiba történt')
    } finally {
      setLoading(false)
    }
  }

  if (valid === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Meghívó ellenőrzése...</div>
      </div>
    )
  }

  if (valid === false) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center max-w-md w-full">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-red-50">
            <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Érvénytelen meghívó</h2>
          <p className="text-gray-500 text-sm">Ez a meghívó link már nem érvényes vagy lejárt. Kérd az adminisztrátortól az új linket.</p>
        </div>
      </div>
    )
  }

  // Extract first name from "Vezetéknév Keresztnév"
  const firstName = name ? name.split(' ').slice(1).join(' ') || name.split(' ')[0] : null

  return (
    <div className="min-h-screen flex">
      {/* Left decorative panel */}
      <div className="hidden lg:flex w-1/2 flex-col items-center justify-center p-12" style={{ background: '#6C5CE7' }}>
        <div className="text-center text-white">
          <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-6">
            <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold mb-3">myBatz Task</h2>
          <p className="text-white/70 text-lg">Belső hibajegy-kezelő rendszer</p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-md">
          <div className="mb-8">
            {firstName && (
              <p className="text-3xl font-bold text-gray-900 mb-1">
                Szia, {firstName}! 👋
              </p>
            )}
            <p className="text-gray-500">
              {firstName
                ? 'Már csak egy jelszóra van szükség, és beléphetsz a myBatz Task felületére.'
                : 'Állíts be jelszót a fiókodhoz, és azonnal beléphetsz.'}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Jelszó</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none"
                  onFocus={e => e.target.style.borderColor = '#6C5CE7'}
                  onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                  placeholder="Legalább 8 karakter"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Jelszó megerősítése</label>
                <input
                  type="password"
                  required
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none"
                  onFocus={e => e.target.style.borderColor = '#6C5CE7'}
                  onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 text-white text-sm font-semibold rounded-xl disabled:opacity-60 transition-opacity"
                style={{ background: '#6C5CE7' }}
              >
                {loading ? 'Belépés...' : 'Jelszó beállítása és belépés'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

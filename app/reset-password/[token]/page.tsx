'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

export default function ResetPasswordPage() {
  const router = useRouter()
  const params = useParams()
  const token = params.token as string

  const [valid, setValid] = useState<boolean | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch(`/api/auth/reset-password/${token}`)
      .then(r => r.json())
      .then(d => setValid(d.valid))
      .catch(() => setValid(false))
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('A két jelszó nem egyezik meg'); return }
    setError('')
    setLoading(true)

    try {
      const res = await fetch(`/api/auth/reset-password/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Visszaállítás sikertelen'); return }
      router.push('/login?reset=1')
    } catch {
      setError('Váratlan hiba történt')
    } finally {
      setLoading(false)
    }
  }

  if (valid === null) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="text-gray-500">Ellenőrzés...</div></div>

  if (!valid) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center max-w-md w-full">
        <div className="text-red-500 text-5xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Érvénytelen vagy lejárt link</h2>
        <p className="text-gray-500 mb-4">Ez a jelszó-visszaállító link már nem érvényes.</p>
        <Link href="/forgot-password" className="text-sm font-medium" style={{ color: '#6C5CE7' }}>Új link kérése</Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4" style={{ background: '#6C5CE7' }}>
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Jelszó visszaállítása</h1>
          <p className="text-gray-500 mt-1">Válassz új jelszót</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Új jelszó</label>
              <input type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none"
                onFocus={e => e.target.style.borderColor = '#6C5CE7'} onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                placeholder="Legalább 8 karakter" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Jelszó megerősítése</label>
              <input type="password" required value={confirm} onChange={e => setConfirm(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none"
                onFocus={e => e.target.style.borderColor = '#6C5CE7'} onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                placeholder="••••••••" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-2.5 px-4 text-white text-sm font-semibold rounded-xl disabled:opacity-60"
              style={{ background: '#6C5CE7' }}>
              {loading ? 'Mentés...' : 'Jelszó visszaállítása'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

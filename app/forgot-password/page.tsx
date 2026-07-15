'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    setSent(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4" style={{ background: '#6C5CE7' }}>
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Elfelejtett jelszó</h1>
          <p className="text-gray-500 mt-1">Küldünk egy visszaállító linket</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {sent ? (
            <div className="text-center">
              <div className="text-green-500 text-4xl mb-4">✓</div>
              <p className="text-gray-700 font-medium mb-2">Ellenőrizd az emailt</p>
              <p className="text-gray-500 text-sm mb-6">Ha létezik fiók a {email} címhez, hamarosan megérkezik a jelszó-visszaállító link.</p>
              <Link href="/login" className="text-sm font-medium" style={{ color: '#6C5CE7' }}>Vissza a bejelentkezéshez</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email cím</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none"
                  onFocus={e => e.target.style.borderColor = '#6C5CE7'} onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                  placeholder="te@pelda.hu" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full py-2.5 px-4 text-white text-sm font-semibold rounded-xl disabled:opacity-60"
                style={{ background: '#6C5CE7' }}>
                {loading ? 'Küldés...' : 'Link küldése'}
              </button>
              <div className="text-center">
                <Link href="/login" className="text-sm text-gray-500 hover:text-gray-700">Vissza a bejelentkezéshez</Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { buildUniqueDisplayNames, renderInlineMarkup } from '@/lib/utils'

interface ChangelogEntry {
  id: string
  version: string
  title: string
  content: string
  authorName: string | null
  publishedAt: string
}

interface NotifyUser {
  id: string
  name: string | null
  firstName?: string | null
  nickname?: string | null
  email: string
}

export default function ChangelogPage() {
  const [entries, setEntries] = useState<ChangelogEntry[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ version: '', title: '', content: '' })
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [allUsers, setAllUsers] = useState<NotifyUser[]>([])
  const [sendNotify, setSendNotify] = useState(false)
  const [notifyAll, setNotifyAll] = useState(true)
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set())
  const [notifyResult, setNotifyResult] = useState<{ notified: number; failed: number } | null>(null)

  const userNameMap = buildUniqueDisplayNames(allUsers)

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.user?.role === 'ADMIN') {
        setIsAdmin(true)
        fetch('/api/users').then(r => r.json()).then(u => setAllUsers(u.users || []))
      }
    })
    loadEntries()
  }, [])

  function loadEntries() {
    fetch('/api/changelog').then(r => r.json()).then(d => setEntries(d.entries || []))
  }

  function toggleUser(id: string) {
    setSelectedUserIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setForm({ version: '', title: '', content: '' })
    setSendNotify(false)
    setNotifyAll(true)
    setSelectedUserIds(new Set())
  }

  function startCreate() {
    setEditingId(null)
    setForm({ version: '', title: '', content: '' })
    setSendNotify(false)
    setNotifyAll(true)
    setSelectedUserIds(new Set())
    setShowForm(true)
  }

  function startEdit(entry: ChangelogEntry) {
    setEditingId(entry.id)
    setForm({ version: entry.version, title: entry.title, content: entry.content })
    setSendNotify(false)
    setShowForm(true)
    // The form renders at the top of the page — bring it into view.
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSave() {
    if (!form.version || !form.title || !form.content) return
    setSaving(true)
    if (editingId) {
      await fetch(`/api/changelog/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
    } else {
      const notifyUserIds = sendNotify
        ? (notifyAll ? allUsers.map(u => u.id) : Array.from(selectedUserIds))
        : []
      const res = await fetch('/api/changelog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, notifyUserIds }),
      })
      if (res.ok && notifyUserIds.length > 0) {
        const d = await res.json()
        setNotifyResult({ notified: d.notified ?? 0, failed: d.failed ?? 0 })
      }
    }
    setSaving(false)
    closeForm()
    loadEntries()
  }

  async function handleDelete(id: string) {
    await fetch(`/api/changelog/${id}`, { method: 'DELETE' })
    setDeleteId(null)
    loadEntries()
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' })
  }

  // Parse content lines into sections
  function renderContent(content: string) {
    const lines = content.split('\n')
    const elements: React.ReactNode[] = []
    let i = 0
    while (i < lines.length) {
      const line = lines[i].trim()
      if (!line) { i++; continue }
      if (line.startsWith('### ')) {
        elements.push(<h3 key={i} className="text-sm font-semibold text-gray-700 mt-4 mb-1.5"
          dangerouslySetInnerHTML={{ __html: renderInlineMarkup(line.slice(4)) }} />)
      } else if (line.startsWith('## ')) {
        elements.push(<h2 key={i} className="text-base font-semibold text-gray-900 mt-5 mb-2"
          dangerouslySetInnerHTML={{ __html: renderInlineMarkup(line.slice(3)) }} />)
      } else if (line.startsWith('- ')) {
        const items: string[] = []
        while (i < lines.length && lines[i].trim().startsWith('- ')) {
          items.push(lines[i].trim().slice(2))
          i++
        }
        elements.push(
          <ul key={`ul-${i}`} className="space-y-1 mb-2">
            {items.map((item, j) => (
              <li key={j} className="flex items-start gap-2 text-sm text-gray-600">
                <span className="text-indigo-400 mt-0.5 shrink-0">•</span>
                <span dangerouslySetInnerHTML={{ __html: renderInlineMarkup(item) }} />
              </li>
            ))}
          </ul>
        )
        continue
      } else {
        elements.push(<p key={i} className="text-sm text-gray-600 mb-2"
          dangerouslySetInnerHTML={{ __html: renderInlineMarkup(line) }} />)
      }
      i++
    }
    return elements
  }

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Link href="/dashboard" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Vissza
          </Link>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#6C5CE7' }}>
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Changelog</h1>
              <p className="text-gray-500 text-sm">Újdonságok és hibajavítások</p>
            </div>
          </div>
          {isAdmin && (
            <button onClick={startCreate}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-xl"
              style={{ background: '#6C5CE7' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Új bejegyzés
            </button>
          )}
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            {editingId ? 'Bejegyzés szerkesztése' : 'Új changelog bejegyzés'}
          </h2>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Verzió (pl. v1.2)</label>
                <input value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  placeholder="v1.0" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Cím</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  placeholder="Funkciók és hibajavítások" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tartalom</label>
              <p className="text-xs text-gray-400 mb-1">Formázás: <code className="bg-gray-100 px-1 rounded">## Cím</code>, <code className="bg-gray-100 px-1 rounded">### Alcím</code>, <code className="bg-gray-100 px-1 rounded">- elem</code>, <code className="bg-gray-100 px-1 rounded">**félkövér**</code></p>
              <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                rows={12}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 font-mono"
                placeholder="## Új funkciók&#10;- Valami új&#10;&#10;## Hibajavítások&#10;- Valami javítás" />
            </div>
            {/* Notification section — only when publishing a new entry */}
            {!editingId && (
              <div className="border-t border-gray-100 pt-3">
                <label className="flex items-center gap-2 cursor-pointer select-none mb-2">
                  <div
                    className="relative w-9 h-5 rounded-full transition-colors cursor-pointer flex-shrink-0"
                    style={{ background: sendNotify ? '#6C5CE7' : '#e5e7eb' }}
                    onClick={() => setSendNotify(v => !v)}
                  >
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${sendNotify ? 'translate-x-4' : ''}`} />
                  </div>
                  <span className="text-sm text-gray-700">E-mail értesítő küldése</span>
                </label>
                {sendNotify && (
                  <div className="pl-1 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" checked={notifyAll} onChange={() => setNotifyAll(true)} className="accent-indigo-500" />
                      <span className="text-sm text-gray-700">Mindenki</span>
                      <span className="text-xs text-gray-400">({allUsers.length} fő)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" checked={!notifyAll} onChange={() => setNotifyAll(false)} className="accent-indigo-500" />
                      <span className="text-sm text-gray-700">Kiválasztott személyek</span>
                    </label>
                    {!notifyAll && (
                      <div className="ml-5 mt-1 max-h-36 overflow-y-auto space-y-1 border border-gray-100 rounded-xl p-2">
                        {allUsers.map(u => (
                          <label key={u.id} className="flex items-center gap-2 cursor-pointer py-0.5">
                            <input type="checkbox" checked={selectedUserIds.has(u.id)} onChange={() => toggleUser(u.id)} className="accent-indigo-500" />
                            <span className="text-sm text-gray-700">{userNameMap[u.id] || u.email}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {editingId && (
              <p className="text-xs text-gray-400 border-t border-gray-100 pt-3">
                Szerkesztéskor nem megy ki e-mail értesítő.
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <button onClick={closeForm}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Mégse</button>
              <button onClick={handleSave} disabled={saving || (!editingId && sendNotify && !notifyAll && selectedUserIds.size === 0)}
                className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50"
                style={{ background: '#6C5CE7' }}>
                {saving ? 'Mentés...' : editingId ? 'Mentés' : 'Közzétesz'}
              </button>
            </div>
          </div>
        </div>
      )}

      {notifyResult && (
        <div className={`mb-6 px-4 py-3 rounded-xl text-sm flex items-center justify-between ${
          notifyResult.failed > 0 ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-green-50 text-green-700 border border-green-100'
        }`}>
          <span>
            {notifyResult.failed > 0
              ? `Értesítő kiküldve ${notifyResult.notified} főnek, ${notifyResult.failed} kézbesítés nem sikerült — próbáld újra, vagy nézd meg a Resend naplót.`
              : `Értesítő kiküldve ${notifyResult.notified} főnek.`}
          </span>
          <button onClick={() => setNotifyResult(null)} className="text-current opacity-60 hover:opacity-100 ml-3">✕</button>
        </div>
      )}

      {/* Entries */}
      <div className="space-y-6">
        {entries.length === 0 && (
          <div className="text-center py-16 text-gray-400 text-sm">Még nincs bejegyzés.</div>
        )}
        {entries.map(entry => (
          <div key={entry.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold text-white" style={{ background: '#6C5CE7' }}>
                  {entry.version}
                </span>
                <h2 className="text-lg font-semibold text-gray-900">{entry.title}</h2>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <p className="text-xs text-gray-400">{formatDate(entry.publishedAt)}</p>
                  {entry.authorName && <p className="text-xs text-gray-500">{entry.authorName}</p>}
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => startEdit(entry)}
                      title="Szerkesztés"
                      className="text-gray-300 hover:text-indigo-500 transition-colors p-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button onClick={() => setDeleteId(entry.id)}
                      title="Törlés"
                      className="text-gray-300 hover:text-red-400 transition-colors p-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="border-t border-gray-50 pt-4">
              {renderContent(entry.content)}
            </div>
          </div>
        ))}
      </div>

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="font-semibold text-gray-900 mb-2">Bejegyzés törlése</h3>
            <p className="text-sm text-gray-600 mb-4">Biztosan törlöd ezt a changelog bejegyzést? Ez nem vonható vissza.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Mégse</button>
              <button onClick={() => handleDelete(deleteId)} className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg">Törlés</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

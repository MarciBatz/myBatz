'use client'

import { useState, useEffect } from 'react'

interface SavedReply {
  id: string; title: string; body: string; createdAt: string
  createdBy: { id: string; name: string | null; email: string }
}

export default function SavedRepliesSection() {
  const [replies, setReplies] = useState<SavedReply[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<SavedReply | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadReplies() }, [])

  async function loadReplies() {
    const r = await fetch('/api/saved-replies')
    const d = await r.json()
    setReplies(d.replies || [])
    setLoading(false)
  }

  function startEdit(reply: SavedReply) {
    setEditing(reply); setTitle(reply.title); setBody(reply.body); setShowForm(true)
  }

  function startCreate() {
    setEditing(null); setTitle(''); setBody(''); setShowForm(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    if (editing) {
      await fetch(`/api/saved-replies/${editing.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body }),
      })
    } else {
      await fetch('/api/saved-replies', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body }),
      })
    }
    setSaving(false); setShowForm(false); loadReplies()
  }

  async function handleDelete(id: string) {
    if (!confirm('Biztosan törlöd ezt a sablon választ?')) return
    await fetch(`/api/saved-replies/${id}`, { method: 'DELETE' })
    loadReplies()
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Sablon válaszok</h2>
          <p className="text-gray-400 text-xs mt-0.5">Újrafelhasználható válaszsablonok a feladatoknál</p>
        </div>
        <button onClick={startCreate}
          className="flex items-center gap-2 px-3 py-1.5 text-white text-sm font-medium rounded-xl"
          style={{ background: '#6C5CE7' }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Új sablon
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 py-2">Betöltés...</p>
      ) : replies.length === 0 ? (
        <p className="text-sm text-gray-400 py-2">Még nincs sablon válasz</p>
      ) : (
        <div className="space-y-2">
          {replies.map(r => (
            <div key={r.id} className="flex items-start justify-between gap-3 py-2 px-3 rounded-lg hover:bg-gray-50">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-900 text-sm">{r.title}</h3>
                <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{r.body}</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => startEdit(r)} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded border border-gray-100 hover:border-gray-200">Szerkesztés</button>
                <button onClick={() => handleDelete(r.id)} className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded border border-red-50 hover:border-red-100">Törlés</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">{editing ? 'Sablon szerkesztése' : 'Új sablon válasz'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Cím</label>
                <input type="text" required value={title} onChange={e => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400"
                  placeholder="pl. Visszaigazolás" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Tartalom</label>
                <textarea required rows={6} value={body} onChange={e => setBody(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:border-indigo-400"
                  placeholder="Válasz szövege..." />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">Mégse</button>
                <button type="submit" disabled={saving}
                  className="px-4 py-2 text-sm text-white font-medium rounded-xl disabled:opacity-60"
                  style={{ background: '#6C5CE7' }}>
                  {saving ? 'Mentés...' : 'Mentés'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { formatRelativeTime } from '@/lib/utils'

interface Notification {
  id: string
  type: string
  message: string
  link: string | null
  read: boolean
  sentAt: string
  ticketId: string
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/notifications')
      .then(r => r.json())
      .then(d => { setNotifications(d.notifications || []); setLoading(false) })
    // Mark all as read
    fetch('/api/notifications', { method: 'PATCH' })
  }, [])

  const typeIcon = (type: string) => {
    if (type === 'mention') return (
      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
        </svg>
      </div>
    )
    return (
      <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
        <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Értesítések</h1>
        <p className="text-gray-500 text-sm mt-0.5">Hozzászólások és megemlítések</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
        {loading ? (
          <div className="py-12 text-center text-gray-400">Betöltés...</div>
        ) : notifications.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <svg className="w-10 h-10 mx-auto mb-3 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            Nincs értesítésed
          </div>
        ) : (
          notifications.map(n => (
            <div key={n.id} className={`flex items-start gap-3 p-4 ${!n.read ? 'bg-purple-50/40' : ''}`}>
              {typeIcon(n.type)}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800">{n.message}</p>
                <p className="text-xs text-gray-400 mt-0.5">{formatRelativeTime(n.sentAt)}</p>
              </div>
              {n.link && (
                <Link href={n.link} className="text-xs font-medium shrink-0" style={{ color: '#6C5CE7' }}>
                  Megnyitás
                </Link>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

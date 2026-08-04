import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'
import { countUnreadNotifications } from '@/lib/notifications-access'

/**
 * Presence ping, which also carries back the sidebar's unread badge count.
 *
 * These used to be two separate pollers (60s and 30s), hitting the server three
 * times a minute per open tab. They are one request now, and the badge is a
 * single COUNT rather than the 50 full notification rows the list returns.
 */
export async function POST(request: NextRequest) {
  const user = await getSessionFromRequest(request)
  if (!user) return NextResponse.json({ ok: false }, { status: 401 })

  const [, unreadCount] = await Promise.all([
    prisma.user.update({
      where: { id: user.id },
      data: { lastSeenAt: new Date() },
      select: { id: true },
    }),
    countUnreadNotifications(user),
  ])

  return NextResponse.json({ ok: true, unreadCount })
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession, unauthorizedResponse } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const user = await requireSession(request)
    const notifications = await prisma.notificationLog.findMany({
      where: { userId: user.id, message: { not: null } },
      orderBy: { sentAt: 'desc' },
      take: 50,
      select: { id: true, type: true, message: true, link: true, read: true, sentAt: true, ticketId: true },
    })
    const unreadCount = await prisma.notificationLog.count({
      where: { userId: user.id, message: { not: null }, read: false },
    })
    return NextResponse.json({ notifications, unreadCount })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorizedResponse()
    return NextResponse.json({ error: 'Szerverhiba történt' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireSession(request)
    await prisma.notificationLog.updateMany({
      where: { userId: user.id, read: false },
      data: { read: true },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorizedResponse()
    return NextResponse.json({ error: 'Szerverhiba történt' }, { status: 500 })
  }
}

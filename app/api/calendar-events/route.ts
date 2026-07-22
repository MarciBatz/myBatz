import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest, unauthorizedResponse } from '@/lib/auth'
import { sendCalendarEventNotificationEmail } from '@/lib/email'
import { userWantsNotification } from '@/lib/permissions'

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return unauthorizedResponse()

  const { searchParams } = new URL(request.url)
  const year = parseInt(searchParams.get('year') || '0')
  const month = parseInt(searchParams.get('month') || '0')

  const where = year && month ? {
    date: {
      gte: new Date(year, month - 1, 1),
      lt: new Date(year, month, 1),
    },
  } : {}

  const events = await prisma.calendarEvent.findMany({
    where,
    include: { createdBy: { select: { firstName: true, lastName: true, name: true, nickname: true, email: true } } },
    orderBy: { date: 'asc' },
  })

  return NextResponse.json({ events })
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return unauthorizedResponse()

  const body = await request.json()
  const { title, description, date, type, notifyUserIds } = body

  if (!title || !date) {
    return NextResponse.json({ error: 'Cím és dátum kötelező' }, { status: 400 })
  }

  const event = await prisma.calendarEvent.create({
    data: {
      title,
      description: description || null,
      date: new Date(date),
      type: type || 'EGYEB',
      createdById: session.id,
    },
  })

  // Send notifications if requested
  if (Array.isArray(notifyUserIds) && notifyUserIds.length > 0) {
    const sender = await prisma.user.findUnique({
      where: { id: session.id },
      select: { name: true, firstName: true, lastName: true, nickname: true },
    })
    const senderName = sender?.nickname || sender?.firstName || sender?.name || 'Valaki'

    const recipients = await prisma.user.findMany({
      where: { id: { in: notifyUserIds }, status: 'ACTIVE' },
      select: { id: true, email: true, name: true, firstName: true, lastName: true, nickname: true },
    })

    await Promise.all(
      recipients.map(async (user) => {
        const wants = await userWantsNotification(user.id, 'calendarEgyeb')
        if (!wants) return
        await sendCalendarEventNotificationEmail(user, { title, date: new Date(date), description }, senderName)
      })
    )
  }

  return NextResponse.json({ event }, { status: 201 })
}

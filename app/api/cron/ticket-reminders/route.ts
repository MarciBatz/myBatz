import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendTicketReminderEmail } from '@/lib/email'

const REMINDER_DAYS = [7, 14, 21, 28]

export async function GET(request: NextRequest) {
  // Verify this is called by Vercel Cron
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()
    let totalSent = 0

    for (const days of REMINDER_DAYS) {
      const windowStart = new Date(now.getTime() - (days + 1) * 24 * 60 * 60 * 1000)
      const windowEnd = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

      const tickets = await prisma.ticket.findMany({
        where: {
          status: { notIn: ['CLOSED'] },
          assigneeId: { not: null },
          createdAt: { gte: windowStart, lt: windowEnd },
        },
        include: {
          assignee: { select: { id: true, email: true, name: true, nickname: true } },
        },
      })

      for (const ticket of tickets) {
        if (!ticket.assignee) continue

        const alreadySent = await prisma.notificationLog.findFirst({
          where: {
            ticketId: ticket.id,
            userId: ticket.assignee.id,
            type: `reminder_${days}d`,
          },
        })
        if (alreadySent) continue

        await sendTicketReminderEmail(ticket.assignee, {
          id: ticket.id,
          title: ticket.title,
          createdAt: ticket.createdAt,
        }, days)

        await prisma.notificationLog.create({
          data: {
            ticketId: ticket.id,
            userId: ticket.assignee.id,
            type: `reminder_${days}d`,
          },
        })

        totalSent++
      }
    }

    return NextResponse.json({ ok: true, sent: totalSent })
  } catch (error) {
    console.error('Cron ticket-reminders error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

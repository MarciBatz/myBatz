import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendSlaBreachEmail } from '@/lib/email'

export async function GET(request: NextRequest) {
  const secret = request.headers.get('authorization')?.replace('Bearer ', '')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const threshold = new Date(Date.now() - 48 * 60 * 60 * 1000)

  const tickets = await prisma.ticket.findMany({
    where: {
      status: { not: 'CLOSED' },
      createdAt: { lte: threshold },
    },
    include: {
      assignee: { select: { id: true, email: true, name: true, nickname: true } },
      createdBy: { select: { id: true, email: true, name: true, nickname: true } },
      comments: { select: { userId: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 },
      notifications: { where: { type: { in: ['sla_no_response', 'sla_unassigned'] } } },
    },
  })

  let sent = 0

  for (const ticket of tickets) {
    const alreadyNotified = ticket.notifications.some(n =>
      n.type === 'sla_no_response' || n.type === 'sla_unassigned'
    )
    if (alreadyNotified) continue

    // Ticket with assignee but no comment from assignee within 48h
    if (ticket.assignee) {
      const assigneeCommented = ticket.comments.some(
        (c: { userId: string | null }) => c.userId === ticket.assignee!.id
      )
      const lastComment = ticket.comments[0]
      const noRecentResponse = !lastComment || new Date(lastComment.createdAt) <= threshold

      if (!assigneeCommented || noRecentResponse) {
        await sendSlaBreachEmail(ticket.assignee, { id: ticket.id, title: ticket.title }, 'no_response')
        await prisma.notificationLog.create({
          data: {
            userId: ticket.assignee.id,
            ticketId: ticket.id,
            type: 'sla_no_response',
            message: `48 órája nem reagáltál erre a feladatra: "${ticket.title}"`,
            link: `/tickets/${ticket.id}`,
          },
        })
        sent++
      }
    } else {
      // Unassigned ticket — notify creator
      if (ticket.createdBy) {
        await sendSlaBreachEmail(ticket.createdBy, { id: ticket.id, title: ticket.title }, 'unassigned')
        await prisma.notificationLog.create({
          data: {
            userId: ticket.createdBy.id,
            ticketId: ticket.id,
            type: 'sla_unassigned',
            message: `48 órája senki sem vette fel magának ezt a feladatot: "${ticket.title}"`,
            link: `/tickets/${ticket.id}`,
          },
        })
        sent++
      }
    }
  }

  return NextResponse.json({ ok: true, sent })
}

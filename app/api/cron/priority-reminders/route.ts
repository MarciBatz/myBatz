import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendPriorityReminderEmail, formatIdleDays } from '@/lib/email'
import { canAccessTicket } from '@/lib/departments-access'

// How long a ticket may sit without movement before its assignee is reminded.
const WINDOW_HOURS: Record<string, number> = {
  CRITICAL: 24,
  HIGH: 72,
  MEDIUM: 168,
  LOW: 336,
}

const REMINDER_TYPE = 'priority_reminder'

export async function GET(_request: NextRequest) {
  try {
    const now = Date.now()

    const tickets = await prisma.ticket.findMany({
      where: { status: { not: 'CLOSED' } },
      include: {
        assignee: { select: { id: true, email: true, name: true, firstName: true, lastName: true, nickname: true, role: true } },
        createdBy: { select: { id: true, email: true, name: true, firstName: true, lastName: true, nickname: true, role: true } },
        // Commenting doesn't touch ticket.updatedAt, so the newest comment is
        // checked separately when working out when the ticket last moved.
        comments: { select: { createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 },
        notifications: {
          where: { type: REMINDER_TYPE },
          select: { sentAt: true },
          orderBy: { sentAt: 'desc' },
          take: 1,
        },
      },
    })

    let sent = 0
    let skipped = 0

    for (const ticket of tickets) {
      const windowHours = WINDOW_HOURS[ticket.priority]
      if (!windowHours) continue
      const windowMs = windowHours * 60 * 60 * 1000

      // Any movement — a field change or a new comment — resets the clock.
      const lastComment = ticket.comments[0]
      const lastActivity = Math.max(
        ticket.updatedAt.getTime(),
        lastComment ? lastComment.createdAt.getTime() : 0
      )
      const idleMs = now - lastActivity
      if (idleMs < windowMs) continue

      // Repeat at most once per window so a long-idle ticket keeps nagging
      // without flooding on every run.
      const lastReminder = ticket.notifications[0]
      if (lastReminder && now - lastReminder.sentAt.getTime() < windowMs) continue

      const unassigned = !ticket.assignee
      const recipient = ticket.assignee ?? ticket.createdBy
      if (!recipient) {
        skipped++
        continue
      }

      // Don't remind someone about a ticket they can no longer open: if the
      // assignee (or creator) lost access to its department, the email would
      // link to a 404. Their reminder resumes if access is restored.
      const canSee = await canAccessTicket({ id: recipient.id, role: recipient.role }, ticket.id)
      if (!canSee) {
        skipped++
        continue
      }

      const idleHours = Math.floor(idleMs / (60 * 60 * 1000))

      await sendPriorityReminderEmail(
        recipient,
        { id: ticket.id, title: ticket.title, priority: ticket.priority },
        idleHours,
        unassigned
      )

      await prisma.notificationLog.create({
        data: {
          userId: recipient.id,
          ticketId: ticket.id,
          type: REMINDER_TYPE,
          message: unassigned
            ? `${formatIdleDays(idleHours)} nincs felelőse ennek a feladatnak: "${ticket.title}"`
            : `${formatIdleDays(idleHours)} nem mozdult ez a feladat: "${ticket.title}"`,
          link: `/tickets/${ticket.id}`,
        },
      })

      sent++
    }

    return NextResponse.json({ ok: true, sent, skipped, checked: tickets.length })
  } catch (error) {
    console.error('Cron priority-reminders error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

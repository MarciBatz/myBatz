import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendTicketDeadlineReminderEmail } from '@/lib/email'
import { getDeadlineRecipients } from '@/lib/ticket-collaborators'
import { userWantsNotification } from '@/lib/permissions'

/**
 * Sends the deadline reminder for public tickets that have both a due date and
 * reminderDaysBefore set. Mirrors the private-task cron: it runs once daily, so
 * the trigger is date-based rather than hour-based — due dates are stored as UTC
 * midnight from a date-only input, so comparing the UTC midnight of "today" to
 * the due date's midnight gives a whole-day count that doesn't shift with the
 * hour the cron happens to run.
 *
 * Closed tickets are skipped: a finished ticket has nothing left to be reminded
 * about, even with a future deadline.
 *
 * Recipients are the assignee and the collaborators — the people doing the
 * work. The creator is deliberately not included; see getDeadlineRecipients.
 */
export async function GET(_request: NextRequest) {
  try {
    const now = new Date()
    const todayMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

    const tickets = await prisma.ticket.findMany({
      where: {
        dueDate: { not: null },
        reminderDaysBefore: { not: null },
        reminderSentAt: null,
        status: { not: 'CLOSED' },
      },
      select: { id: true, title: true, dueDate: true, priority: true, reminderDaysBefore: true },
    })

    let sent = 0
    let withoutRecipients = 0

    for (const ticket of tickets) {
      if (!ticket.dueDate || ticket.reminderDaysBefore == null) continue
      const dueMidnight = new Date(Date.UTC(
        ticket.dueDate.getUTCFullYear(), ticket.dueDate.getUTCMonth(), ticket.dueDate.getUTCDate()
      ))
      const daysUntilDue = Math.round((dueMidnight.getTime() - todayMidnight.getTime()) / (24 * 60 * 60 * 1000))
      if (daysUntilDue > ticket.reminderDaysBefore) continue // not yet time

      const recipients = await getDeadlineRecipients(ticket.id)
      // Each person's own ticket-notification preference still applies — this is
      // a ticket email like any other, not a mandatory access notice.
      const willing = []
      for (const r of recipients) {
        if (await userWantsNotification(r.id, 'tickets')) willing.push(r)
      }

      // Nobody to tell (no assignee, no collaborators, or all opted out). The
      // flag is still set: the window has passed, and leaving it unset would
      // re-check this ticket every morning for as long as it exists.
      if (willing.length === 0) withoutRecipients++
      else {
        await sendTicketDeadlineReminderEmail(willing, {
          id: ticket.id, title: ticket.title, dueDate: ticket.dueDate, priority: ticket.priority,
        })
        await prisma.notificationLog.createMany({
          data: willing.map(r => ({
            userId: r.id,
            ticketId: ticket.id,
            type: 'due_date_reminder',
            message: `Közelgő határidő: "${ticket.title}"`,
            link: `/tickets/${ticket.id}`,
          })),
        })
        sent += willing.length
      }

      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { reminderSentAt: new Date() },
      })
    }

    return NextResponse.json({ ok: true, sent, checked: tickets.length, withoutRecipients })
  } catch (error) {
    console.error('Cron ticket-reminders error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

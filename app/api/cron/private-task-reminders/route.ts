import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendPrivateTaskDeadlineReminderEmail } from '@/lib/email'

/**
 * Sends the deadline reminder for private tasks that have both a due date and
 * reminderDaysBefore set. Runs once daily, so the trigger is date-based (not
 * hour-based): due dates are stored as UTC midnight from a date-only input, so
 * comparing the UTC midnight of "today" to the due date's midnight gives a
 * whole-day count unaffected by what hour the cron happens to run.
 *
 * Archived or Kész tasks are skipped — a finished task has nothing left to be
 * reminded about, even if its due date is still in the future.
 */
export async function GET(_request: NextRequest) {
  try {
    const todayMidnight = new Date(Date.UTC(
      new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()
    ))

    const tasks = await prisma.privateTask.findMany({
      where: {
        dueDate: { not: null },
        reminderDaysBefore: { not: null },
        reminderSentAt: null,
        archivedAt: null,
        column: { not: 'DONE' },
      },
      include: {
        user: { select: { id: true, email: true, name: true, firstName: true, nickname: true } },
      },
    })

    let sent = 0
    for (const task of tasks) {
      if (!task.dueDate || task.reminderDaysBefore == null) continue
      const dueMidnight = new Date(Date.UTC(
        task.dueDate.getUTCFullYear(), task.dueDate.getUTCMonth(), task.dueDate.getUTCDate()
      ))
      const daysUntilDue = Math.round((dueMidnight.getTime() - todayMidnight.getTime()) / (24 * 60 * 60 * 1000))
      if (daysUntilDue > task.reminderDaysBefore) continue // not yet time

      await sendPrivateTaskDeadlineReminderEmail(task.user, { id: task.id, title: task.title, dueDate: task.dueDate })
      await prisma.privateTask.update({ where: { id: task.id }, data: { reminderSentAt: new Date() } })
      sent++
    }

    return NextResponse.json({ ok: true, sent, checked: tasks.length })
  } catch (error) {
    console.error('Cron private-task-reminders error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

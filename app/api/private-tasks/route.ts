import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { unauthorizedResponse, forbiddenResponse } from '@/lib/auth'
import { requirePrivateTaskAccess } from '@/lib/private-tasks-auth'
import { isPrivateTaskColumn } from '@/lib/private-tasks'
import { writeAuditLog } from '@/lib/audit'
import { logTaskCreated } from '@/lib/private-task-events'

/**
 * A ticket may only be linked if the caller is still its assignee and it is
 * open. Anything else would let someone attach their board to a ticket they
 * have no part in, and surface their name on it.
 */
async function assertLinkable(ticketId: string, userId: string): Promise<boolean> {
  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, assigneeId: userId, status: { not: 'CLOSED' } },
    select: { id: true },
  })
  return !!ticket
}

export async function GET(request: NextRequest) {
  try {
    const session = await requirePrivateTaskAccess(request)

    const [tasks, linkableTickets] = await Promise.all([
      prisma.privateTask.findMany({
        // Archived tasks live in the archive view, not on the board.
        where: { userId: session.id, archivedAt: null },
        include: {
          ticket: { select: { id: true, title: true, status: true } },
          _count: { select: { comments: true } },
        },
        orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
      }),
      prisma.ticket.findMany({
        where: { assigneeId: session.id, status: { not: 'CLOSED' } },
        select: { id: true, title: true, status: true, priority: true },
        orderBy: { updatedAt: 'desc' },
      }),
    ])

    return NextResponse.json({ tasks, linkableTickets })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorizedResponse()
    if (error instanceof Error && error.message === 'FORBIDDEN') return forbiddenResponse()
    console.error('Private tasks GET error:', error)
    return NextResponse.json({ error: 'Nem sikerült betölteni a privát feladatokat' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePrivateTaskAccess(request)
    const { title, description, column, priority, dueDate, reminderDaysBefore, ticketId } = await request.json()

    if (!title || !String(title).trim()) {
      return NextResponse.json({ error: 'A cím megadása kötelező' }, { status: 400 })
    }
    if (column && !isPrivateTaskColumn(column)) {
      return NextResponse.json({ error: 'Ismeretlen oszlop' }, { status: 400 })
    }
    if (ticketId && !(await assertLinkable(ticketId, session.id))) {
      return NextResponse.json(
        { error: 'Csak olyan nyitott feladathoz kapcsolhatod, aminek te vagy a felelőse' },
        { status: 400 }
      )
    }
    // A reminder needs a deadline to count back from.
    const reminder = dueDate && Number.isInteger(reminderDaysBefore) ? reminderDaysBefore : null

    const task = await prisma.privateTask.create({
      data: {
        userId: session.id,
        title: String(title).trim(),
        description: description ? String(description) : null,
        column: isPrivateTaskColumn(column) ? column : 'TODO',
        priority: priority || 'MEDIUM',
        dueDate: dueDate ? new Date(dueDate) : null,
        reminderDaysBefore: reminder,
        ticketId: ticketId || null,
      },
      include: { ticket: { select: { id: true, title: true, status: true } } },
    })

    await logTaskCreated(task.id, task.column)
    // Content-free by design: only that a private task exists and its id, so
    // the log can show usage without ever naming what the task is about.
    await writeAuditLog(session.id, 'private_task_created', `Privát feladat létrehozva (ID: ${task.id})`, request)

    return NextResponse.json({ task }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorizedResponse()
    if (error instanceof Error && error.message === 'FORBIDDEN') return forbiddenResponse()
    console.error('Private tasks POST error:', error)
    return NextResponse.json({ error: 'Nem sikerült létrehozni a feladatot' }, { status: 500 })
  }
}

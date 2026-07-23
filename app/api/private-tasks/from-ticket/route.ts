import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { unauthorizedResponse, forbiddenResponse } from '@/lib/auth'
import { requirePrivateTaskAccess } from '@/lib/private-tasks-auth'
import { writeAuditLog } from '@/lib/audit'
import { logTaskCreated } from '@/lib/private-task-events'
import { htmlToPlainText } from '@/lib/utils'

/**
 * Creates a private task from a ticket the caller is assigned to, copying the
 * title, description and priority server-side and dropping it in the Teendő
 * column. The copy happens here rather than trusting client-sent fields so the
 * private task always reflects the real ticket, and so the private-tasks rail
 * (which only knows the ticket id) can use the same path as the ticket page.
 *
 * Multiple private tasks per ticket are allowed on purpose — a complex ticket
 * may be broken into several micro-tasks — so this never de-duplicates.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requirePrivateTaskAccess(request)
    const { ticketId } = await request.json()

    if (!ticketId || typeof ticketId !== 'string') {
      return NextResponse.json({ error: 'Hiányzó ticketId' }, { status: 400 })
    }

    // Must be the current assignee of an open ticket — same rule as linking.
    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, assigneeId: session.id, status: { not: 'CLOSED' } },
      select: { id: true, title: true, description: true, priority: true },
    })
    if (!ticket) {
      return NextResponse.json(
        { error: 'Csak olyan nyitott feladatot vehetsz fel, aminek te vagy a felelőse' },
        { status: 400 }
      )
    }

    const task = await prisma.privateTask.create({
      data: {
        userId: session.id,
        title: ticket.title,
        // Ticket descriptions are HTML; flatten so tags don't show literally.
        description: ticket.description ? htmlToPlainText(ticket.description) || null : null,
        column: 'TODO',
        priority: ticket.priority,
        ticketId: ticket.id,
      },
      include: { ticket: { select: { id: true, title: true, status: true } } },
    })

    await logTaskCreated(task.id, 'TODO')
    await writeAuditLog(session.id, 'private_task_created', `Privát feladat létrehozva ticketből (ID: ${task.id})`, request)

    return NextResponse.json({ task }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorizedResponse()
    if (error instanceof Error && error.message === 'FORBIDDEN') return forbiddenResponse()
    console.error('Private task from-ticket error:', error)
    return NextResponse.json({ error: 'Nem sikerült felvenni a privát feladatok közé' }, { status: 500 })
  }
}

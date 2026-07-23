import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireSession, requireReadWrite, getSessionFromRequest, unauthorizedResponse, forbiddenResponse } from '@/lib/auth'
import { sendTicketUpdateEmail } from '@/lib/email'
import { hasPermission } from '@/lib/permissions'

const updateSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().min(1).optional(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'AWAITING', 'CLOSED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  categoryId: z.string().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  pinned: z.boolean().optional(),
})

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSession(request)
    const { id } = await params

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        category: true,
        assignee: { select: { id: true, name: true, firstName: true, lastName: true, nickname: true, email: true, avatarUrl: true, lastSeenAt: true } },
        createdBy: { select: { id: true, name: true, firstName: true, lastName: true, nickname: true, email: true, avatarUrl: true, lastSeenAt: true } },
        comments: {
          include: {
            user: { select: { id: true, name: true, firstName: true, lastName: true, nickname: true, email: true, avatarUrl: true } },
            attachments: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        attachments: true,
        activities: {
          include: {
            user: { select: { id: true, name: true, firstName: true, lastName: true, nickname: true, email: true, avatarUrl: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    // READER: filter out internal comments
    if (user.role === 'READER') {
      ticket.comments = ticket.comments.filter((c: { isInternal: boolean }) => !c.isInternal)
    }

    // Whether the current assignee tracks this ticket on their private board.
    // Deliberately an aggregate: owner name, newest timestamp, and a per-phase
    // count — never the tasks themselves. Tied to the *current* assignee, so a
    // link made by a previous assignee stops being shown once the ticket moves on.
    let privateWork: {
      ownerName: string
      lastUpdatedAt: Date
      phases: Record<string, number>
    } | null = null
    if (ticket.assigneeId) {
      const linked = await prisma.privateTask.findMany({
        where: { ticketId: ticket.id, userId: ticket.assigneeId },
        select: { updatedAt: true, column: true },
        orderBy: { updatedAt: 'desc' },
      })
      if (linked.length > 0 && ticket.assignee) {
        const a = ticket.assignee
        const phases: Record<string, number> = {}
        for (const t of linked) phases[t.column] = (phases[t.column] || 0) + 1
        privateWork = {
          ownerName: a.nickname || a.firstName || a.name || a.email,
          lastUpdatedAt: linked[0].updatedAt,
          phases,
        }
      }
    }

    return NextResponse.json({ ticket, privateWork })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return unauthorizedResponse()
    }
    console.error('Ticket GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireReadWrite(request)
    const { id } = await params
    const body = await request.json()
    const data = updateSchema.parse(body)

    const existing = await prisma.ticket.findUnique({
      where: { id },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    const ticket = await prisma.ticket.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.priority !== undefined && { priority: data.priority }),
        ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
        ...(data.assigneeId !== undefined && { assigneeId: data.assigneeId }),
        ...(data.pinned !== undefined && { pinned: data.pinned }),
      },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        category: true,
      },
    })

    const statusLabel: Record<string, string> = { OPEN: 'Nyitott', IN_PROGRESS: 'Folyamatban', AWAITING: 'Várakozik', CLOSED: 'Lezárt' }
    const priorityLabel: Record<string, string> = { LOW: 'Alacsony', MEDIUM: 'Közepes', HIGH: 'Magas', CRITICAL: 'Kritikus' }

    // Log activities for changes
    const activityLogs = []
    const changes: string[] = []

    if (data.status && data.status !== existing.status) {
      activityLogs.push({ ticketId: id, userId: user.id, action: 'status_changed', oldValue: existing.status, newValue: data.status })
      changes.push(`Státusz: ${statusLabel[existing.status] ?? existing.status} → ${statusLabel[data.status] ?? data.status}`)
    }
    if (data.priority && data.priority !== existing.priority) {
      activityLogs.push({ ticketId: id, userId: user.id, action: 'priority_changed', oldValue: existing.priority, newValue: data.priority })
      changes.push(`Prioritás: ${priorityLabel[existing.priority] ?? existing.priority} → ${priorityLabel[data.priority] ?? data.priority}`)
    }
    if (data.assigneeId !== undefined && data.assigneeId !== existing.assigneeId) {
      activityLogs.push({ ticketId: id, userId: user.id, action: 'assignee_changed', oldValue: existing.assigneeId || 'none', newValue: data.assigneeId || 'none' })
      changes.push('Felelős megváltozott')
    }
    if (data.categoryId !== undefined && data.categoryId !== existing.categoryId) {
      activityLogs.push({ ticketId: id, userId: user.id, action: 'category_changed', oldValue: existing.categoryId || 'none', newValue: data.categoryId || 'none' })
      // kategória változás nem küld e-mailt
    }

    if (activityLogs.length > 0) {
      await prisma.activityLog.createMany({ data: activityLogs })
    }

    // Notify relevant users
    if (changes.length > 0) {
      const notifyUsers: { email: string; name?: string | null }[] = []
      if (ticket.assignee && ticket.assignee.id !== user.id) notifyUsers.push(ticket.assignee)
      if (ticket.createdBy && ticket.createdBy.id !== user.id && !notifyUsers.find(u => u.email === ticket.createdBy!.email)) {
        notifyUsers.push(ticket.createdBy)
      }

      if (notifyUsers.length > 0) {
        await sendTicketUpdateEmail(notifyUsers, ticket, changes.join('; '))
      }
    }

    return NextResponse.json({ ticket })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return unauthorizedResponse()
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Validation error" }, { status: 400 })
    }
    console.error('Ticket PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) return unauthorizedResponse()
    const canDelete = await hasPermission(session.id, session.role, 'canDeleteTickets')
    if (!canDelete) return forbiddenResponse()
    const user = session

    const { id } = await params
    const existing = await prisma.ticket.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })

    await prisma.ticket.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorizedResponse()
    if (error instanceof Error && error.message === 'FORBIDDEN') return forbiddenResponse()
    console.error('Ticket DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

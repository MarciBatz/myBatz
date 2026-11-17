import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireSession, requireReadWrite, getSessionFromRequest, unauthorizedResponse, forbiddenResponse } from '@/lib/auth'
import { sendTicketUpdateEmail } from '@/lib/email'
import { getActivityRecipients } from '@/lib/ticket-collaborators'
import { hasPermission } from '@/lib/permissions'
import { COMPANY_WIDE } from '@/lib/departments'
import { canAccessTicket, notFoundResponse, resolveTicketTarget, isEligibleAssignee } from '@/lib/departments-access'
import { isValidCategoryForTarget } from '@/lib/categories-access'

const updateSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().min(1).optional(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'AWAITING', 'CLOSED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  categoryId: z.string().optional().nullable(),
  // Permissive here, rejected in the handler, so null and "" give the same
  // Hungarian message rather than Zod's raw type error.
  assigneeId: z.string().optional().nullable(),
  pinned: z.boolean().optional(),
  // yyyy-mm-dd or null to clear. Stored as UTC midnight so the reminder cron
  // can count whole days, exactly as PrivateTask does.
  dueDate: z.string().optional().nullable(),
  reminderDaysBefore: z.number().int().min(0).max(365).optional().nullable(),
  // ADMIN-only; validated below.
  visibility: z.enum(['DEPARTMENT', 'COMPANY_WIDE']).optional(),
  departmentId: z.string().optional().nullable(),
})

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSession(request)
    const { id } = await params

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        category: true,
        department: { select: { id: true, name: true, color: true } },
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
        collaborators: {
          include: {
            user: { select: { id: true, name: true, firstName: true, lastName: true, nickname: true, email: true, avatarUrl: true, lastSeenAt: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        activities: {
          include: {
            user: { select: { id: true, name: true, firstName: true, lastName: true, nickname: true, email: true, avatarUrl: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    // Same 404 whether the ticket is missing or out of the user's department
    // scope — the response must not reveal that an inaccessible ticket exists.
    if (!ticket || !(await canAccessTicket(user, id))) {
      return notFoundResponse()
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
        // Archived tasks are filed away — they no longer describe active work.
        where: { ticketId: ticket.id, userId: ticket.assigneeId, archivedAt: null },
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

    // How many non-archived private tasks the *viewer* already has for this
    // ticket — drives the "Felveszem" button state and the re-add confirm.
    const viewerLinkedCount = await prisma.privateTask.count({
      where: { ticketId: ticket.id, userId: user.id, archivedAt: null },
    })

    return NextResponse.json({ ticket, privateWork, viewerLinkedCount })
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

    // A ticket may be reassigned but not left unowned. (Tickets created before
    // this rule can still hold null; they simply can't be moved back to null.)
    if (data.assigneeId !== undefined && !data.assigneeId) {
      return NextResponse.json(
        { error: 'A felelős nem vehető le — minden feladatnak kell felelőse. Válassz helyette másik felelőst.' },
        { status: 400 }
      )
    }

    const existing = await prisma.ticket.findUnique({
      where: { id },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        department: { select: { id: true, name: true } },
      },
    })

    if (!existing || !(await canAccessTicket(user, id))) {
      return notFoundResponse()
    }

    // Visibility / department change is ADMIN-only.
    const wantsTargetChange = data.visibility !== undefined || data.departmentId !== undefined
    if (wantsTargetChange && user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'A feladat részlegét csak adminisztrátor módosíthatja.' },
        { status: 403 }
      )
    }

    let newTarget: { visibility: 'DEPARTMENT' | 'COMPANY_WIDE'; departmentId: string | null } | null = null
    if (wantsTargetChange) {
      const resolved = await resolveTicketTarget(
        user,
        {
          visibility: data.visibility ?? existing.visibility,
          departmentId: data.departmentId ?? existing.departmentId,
        },
        true // ADMIN always may set company-wide
      )
      if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: 400 })
      newTarget = { visibility: resolved.visibility, departmentId: resolved.departmentId }
    }

    // Whatever the ticket looks like after this update, the assignee must be
    // able to see it. Checked against the *resulting* target, not the old one.
    const effectiveTarget = newTarget ?? { visibility: existing.visibility, departmentId: existing.departmentId }
    const effectiveAssigneeId = data.assigneeId !== undefined ? data.assigneeId : existing.assigneeId
    if (effectiveAssigneeId && !(await isEligibleAssignee(effectiveAssigneeId, effectiveTarget))) {
      return NextResponse.json(
        {
          error: newTarget
            ? 'A feladat jelenlegi felelőse nem tartozik a kiválasztott részleghez. Válassz másik felelőst, vagy vedd le a felelőst a feladatról.'
            : 'A kiválasztott felelős nem tartozik ehhez a részleghez.',
          reason: 'ASSIGNEE_NOT_IN_DEPARTMENT',
        },
        { status: 400 }
      )
    }

    // Categories are per-department. An explicitly sent one is validated against
    // the resulting target and rejected if it doesn't fit; but when the target
    // itself is what changed, the ticket's old category is simply dropped rather
    // than blocking the move — the admin is reorganising, not editing metadata.
    let categoryUpdate: { categoryId: string | null } | null = null
    if (data.categoryId !== undefined) {
      if (!(await isValidCategoryForTarget(data.categoryId, effectiveTarget))) {
        return NextResponse.json(
          {
            error: effectiveTarget.visibility === COMPANY_WIDE
              ? 'Teljes céges feladathoz nem választható kategória, mert a kategóriák részlegenként külön állnak.'
              : 'A kiválasztott kategória nem ehhez a részleghez tartozik.',
            reason: 'CATEGORY_NOT_IN_DEPARTMENT',
          },
          { status: 400 }
        )
      }
      categoryUpdate = { categoryId: data.categoryId }
    } else if (newTarget && existing.categoryId && !(await isValidCategoryForTarget(existing.categoryId, effectiveTarget))) {
      categoryUpdate = { categoryId: null }
    }

    // The deadline is a calendar day, not an instant: midnight UTC, so the
    // daily cron's whole-day arithmetic is unaffected by the hour it runs.
    const nextDueDate = data.dueDate !== undefined
      ? (data.dueDate ? new Date(`${data.dueDate.slice(0, 10)}T00:00:00.000Z`) : null)
      : undefined
    if (nextDueDate !== undefined && nextDueDate !== null && Number.isNaN(nextDueDate.getTime())) {
      return NextResponse.json({ error: 'Érvénytelen határidő.' }, { status: 400 })
    }

    // No deadline means no reminder, whatever was selected — a reminder with
    // nothing to count back from would never fire and would sit in the UI
    // looking active.
    const effectiveDue = nextDueDate !== undefined ? nextDueDate : existing.dueDate
    const requestedReminder = data.reminderDaysBefore !== undefined
      ? data.reminderDaysBefore
      : existing.reminderDaysBefore
    const nextReminder = effectiveDue ? requestedReminder : null

    // Re-arm the reminder whenever the deadline or the lead time moves:
    // reminderSentAt is what stops the cron repeating itself, so leaving it set
    // would mean a deadline pushed back a month never reminds anyone again.
    const reminderConfigChanged =
      (nextDueDate !== undefined && nextDueDate?.getTime() !== existing.dueDate?.getTime())
      || nextReminder !== existing.reminderDaysBefore

    // Field update and its activity log entries commit together, so a department
    // change can never land without its audit trail.
    const ticket = await prisma.ticket.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.priority !== undefined && { priority: data.priority }),
        ...(categoryUpdate !== null && categoryUpdate),
        ...(data.assigneeId !== undefined && { assigneeId: data.assigneeId }),
        ...(data.pinned !== undefined && { pinned: data.pinned }),
        ...(nextDueDate !== undefined && { dueDate: nextDueDate }),
        ...((data.dueDate !== undefined || data.reminderDaysBefore !== undefined) && { reminderDaysBefore: nextReminder }),
        ...(reminderConfigChanged && { reminderSentAt: null }),
        ...(newTarget !== null && { visibility: newTarget.visibility, departmentId: newTarget.departmentId }),
      },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        category: true,
        department: { select: { id: true, name: true, color: true } },
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
    if (nextDueDate !== undefined && nextDueDate?.getTime() !== existing.dueDate?.getTime()) {
      const fmt = (d: Date | null) => d ? d.toISOString().slice(0, 10) : 'nincs'
      activityLogs.push({ ticketId: id, userId: user.id, action: 'due_date_changed', oldValue: fmt(existing.dueDate), newValue: fmt(nextDueDate) })
      changes.push(`Határidő: ${fmt(existing.dueDate)} → ${fmt(nextDueDate)}`)
    }
    if (categoryUpdate !== null && categoryUpdate.categoryId !== existing.categoryId) {
      activityLogs.push({ ticketId: id, userId: user.id, action: 'category_changed', oldValue: existing.categoryId || 'none', newValue: categoryUpdate.categoryId || 'none' })
      // kategória változás nem küld e-mailt
    }
    if (newTarget && (newTarget.visibility !== existing.visibility || newTarget.departmentId !== existing.departmentId)) {
      // Human-readable names in the log, not raw ids — the Napló shows these directly.
      const oldLabel = existing.visibility === COMPANY_WIDE ? 'Teljes cég' : (existing.department?.name ?? '—')
      const newLabel = newTarget.visibility === COMPANY_WIDE ? 'Teljes cég' : (ticket.department?.name ?? '—')
      activityLogs.push({ ticketId: id, userId: user.id, action: 'department_changed', oldValue: oldLabel, newValue: newLabel })
      changes.push(`Részleg: ${oldLabel} → ${newLabel}`)
    }

    if (activityLogs.length > 0) {
      await prisma.activityLog.createMany({ data: activityLogs })
    }

    // Notify relevant users: assignee, creator and anyone pulled onto the
    // ticket. One central list, deduplicated by id — the person who made the
    // change is never mailed about their own edit.
    if (changes.length > 0) {
      const notifyUsers = await getActivityRecipients(id, user.id)
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
    if (!existing || !(await canAccessTicket(user, id))) return notFoundResponse()

    await prisma.ticket.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorizedResponse()
    if (error instanceof Error && error.message === 'FORBIDDEN') return forbiddenResponse()
    console.error('Ticket DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

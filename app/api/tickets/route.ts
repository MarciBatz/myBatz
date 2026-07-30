import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireSession, requireReadWrite, unauthorizedResponse , forbiddenResponse} from '@/lib/auth'
import { sendNewTicketEmail } from '@/lib/email'
import { fullDisplayName } from '@/lib/utils'
import { hasPermission } from '@/lib/permissions'
import { COMPANY_WIDE } from '@/lib/departments'
import { scopedTicketWhere, resolveTicketTarget, isEligibleAssignee, getSelectableDepartments, getEligibleTicketUsers } from '@/lib/departments-access'

const attachmentSchema = z.object({
  fileUrl: z.string(),
  fileName: z.string(),
  fileSize: z.number().optional(),
  mimeType: z.string().optional(),
})

const createSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().min(1),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  categoryId: z.string().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  visibility: z.enum(['DEPARTMENT', 'COMPANY_WIDE']).optional(),
  departmentId: z.string().optional().nullable(),
  attachments: z.array(attachmentSchema).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const user = await requireSession(request)
    const { searchParams } = request.nextUrl

    // Validate the enum-ish params instead of casting them into the query.
    const STATUSES = ['OPEN', 'IN_PROGRESS', 'AWAITING', 'CLOSED'] as const
    const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const
    const rawStatus = searchParams.get('status')
    const rawPriority = searchParams.get('priority')
    const status = STATUSES.find(s => s === rawStatus)
    const priority = PRIORITIES.find(p => p === rawPriority)
    const categoryId = searchParams.get('categoryId') || undefined
    const assigneeId = searchParams.get('assigneeId') || undefined
    const search = searchParams.get('search') || undefined
    const excludeClosed = searchParams.get('excludeClosed') === 'true'
    // Repeatable ?departmentIds=… narrows within what the user may already see.
    const departmentIdsParam = searchParams.getAll('departmentIds').filter(Boolean)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')

    // Every condition is pushed into a single AND list, so adding one can never
    // accidentally widen the result set the way a stray top-level OR could.
    const and: Prisma.TicketWhereInput[] = []
    if (status) and.push({ status })
    else if (excludeClosed) and.push({ status: { not: 'CLOSED' } })
    if (priority) and.push({ priority })
    if (categoryId) and.push({ categoryId })
    if (assigneeId) and.push({ assigneeId })
    if (search) {
      and.push({
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      })
    }

    // Department narrowing: a filter, never a widening. Requested ids are
    // intersected with the user's own scope, and company-wide tickets always
    // stay in view. A stale/empty selection falls back to the full scope rather
    // than hiding everything.
    if (departmentIdsParam.length > 0) {
      const selectable = await getSelectableDepartments(user)
      const allowed = new Set(selectable.map(d => d.id))
      const requested = departmentIdsParam.filter(d => allowed.has(d))
      if (requested.length > 0 && requested.length < allowed.size) {
        and.push({ OR: [{ visibility: COMPANY_WIDE }, { departmentId: { in: requested } }] })
      }
    }

    const where = await scopedTicketWhere(user, and.length > 0 ? { AND: and } : {})

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        include: {
          category: true,
          department: { select: { id: true, name: true, color: true } },
          assignee: { select: { id: true, name: true, firstName: true, lastName: true, nickname: true, email: true, avatarUrl: true } },
          createdBy: { select: { id: true, name: true, firstName: true, lastName: true, nickname: true, email: true, avatarUrl: true } },
          _count: { select: { comments: true } },
        },
        orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.ticket.count({ where }),
    ])

    return NextResponse.json({ tickets, total, page, pageSize })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return unauthorizedResponse()
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return forbiddenResponse('Ehhez a művelethez nincs jogosultságod.')
    }
    console.error('Tickets GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireReadWrite(request)
    const body = await request.json()
    const data = createSchema.parse(body)

    // Resolve and validate the visibility target server-side. A user with no
    // departments and no company-wide permission simply has nowhere to file a
    // ticket, and gets told so.
    const canCompanyWide = await hasPermission(user.id, user.role, 'canCreateCompanyWideTasks')
    const selectable = await getSelectableDepartments(user)
    if (selectable.length === 0 && !canCompanyWide) {
      return NextResponse.json(
        { error: 'Nem tartozol egyetlen részleghez sem, ezért nem tudsz publikus feladatot létrehozni. Kérj hozzáférést egy adminisztrátortól.' },
        { status: 400 }
      )
    }

    // A single-department user needn't send departmentId; fall back to it.
    const requestedTarget = {
      visibility: data.visibility ?? 'DEPARTMENT',
      departmentId: data.departmentId ?? (selectable.length === 1 ? selectable[0].id : null),
    }
    const target = await resolveTicketTarget(user, requestedTarget, canCompanyWide)
    if (!target.ok) {
      return NextResponse.json({ error: target.error }, { status: 400 })
    }

    // The assignee must be able to see the ticket they're given.
    if (data.assigneeId && !(await isEligibleAssignee(data.assigneeId, target))) {
      return NextResponse.json(
        { error: 'A kiválasztott felelős nem tartozik ehhez a részleghez.' },
        { status: 400 }
      )
    }

    const ticket = await prisma.ticket.create({
      data: {
        title: data.title,
        description: data.description,
        priority: data.priority || 'MEDIUM',
        categoryId: data.categoryId || null,
        assigneeId: data.assigneeId || null,
        visibility: target.visibility,
        departmentId: target.departmentId,
        createdById: user.id,
        ...(data.attachments && data.attachments.length > 0 && {
          attachments: {
            create: data.attachments.map(a => ({
              fileUrl: a.fileUrl,
              fileName: a.fileName,
              fileSize: a.fileSize || 0,
              mimeType: a.mimeType,
              uploadedById: user.id,
            })),
          },
        }),
      },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        category: true,
        department: { select: { id: true, name: true, color: true } },
      },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        ticketId: ticket.id,
        userId: user.id,
        action: 'created',
        newValue: 'Ticket created',
      },
    })

    const creatorName = fullDisplayName(user)

    let notifyUsers: { id: string; email: string; name: string | null; nickname: string | null; firstName: string | null }[]
    if (ticket.assignee) {
      notifyUsers = [{ id: ticket.assignee.id, email: ticket.assignee.email, name: ticket.assignee.name, nickname: null, firstName: null }]
    } else {
      // Unassigned: notify only people who can actually see this ticket, so a
      // department ticket never reaches someone outside it. Company-wide
      // visibility widens who *may* be notified, but the trigger is unchanged
      // (still only the "new unassigned ticket" event).
      const eligible = await getEligibleTicketUsers(target)
      notifyUsers = eligible
        .filter(u => u.id !== user.id && u.role !== 'READER')
        .map(u => ({ id: u.id, email: u.email, name: u.name, nickname: u.nickname, firstName: u.firstName }))
    }

    await sendNewTicketEmail(notifyUsers, {
      id: ticket.id,
      title: ticket.title,
      description: ticket.description,
      priority: ticket.priority,
    }, creatorName)

    return NextResponse.json({ ticket }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return unauthorizedResponse()
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return forbiddenResponse('Ehhez a művelethez nincs jogosultságod.')
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Validation error" }, { status: 400 })
    }
    console.error('Tickets POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

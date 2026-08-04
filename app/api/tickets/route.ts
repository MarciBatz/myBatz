import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireSession, requireReadWrite, unauthorizedResponse , forbiddenResponse} from '@/lib/auth'
import { sendNewTicketEmail } from '@/lib/email'
import { fullDisplayName } from '@/lib/utils'
import { hasPermission } from '@/lib/permissions'
import { COMPANY_WIDE } from '@/lib/departments'
import { scopedTicketWhere, resolveTicketTarget, isEligibleAssignee, getSelectableDepartments } from '@/lib/departments-access'
import { isValidCategoryForTarget } from '@/lib/categories-access'
import { ticketStatsFor } from '@/lib/ticket-stats'

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
  // Kept permissive in the schema and required in the handler below, so a
  // missing, null and empty assignee all produce the same Hungarian message
  // instead of Zod's raw type error.
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
    //
    // Kept as its own clause rather than only pushed into `and`, because the
    // dashboard counters below are scoped by department but *not* by the other
    // filters — the same split the standalone stats endpoint makes.
    let departmentClause: Prisma.TicketWhereInput | null = null
    if (departmentIdsParam.length > 0) {
      const selectable = await getSelectableDepartments(user)
      const allowed = new Set(selectable.map(d => d.id))
      const requested = departmentIdsParam.filter(d => allowed.has(d))
      if (requested.length > 0 && requested.length < allowed.size) {
        departmentClause = { OR: [{ visibility: COMPANY_WIDE }, { departmentId: { in: requested } }] }
        and.push(departmentClause)
      }
    }

    const where = await scopedTicketWhere(user, and.length > 0 ? { AND: and } : {})

    // The dashboard used to fetch its counters as a second request on every
    // poll. Asking for them here costs one grouped query instead of a whole
    // extra invocation.
    const withStats = request.nextUrl.searchParams.get('withStats') === 'true'
    const statsWhere = withStats
      ? await scopedTicketWhere(user, departmentClause ? { AND: [departmentClause] } : {})
      : null

    const [tickets, total, stats] = await Promise.all([
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
      statsWhere ? ticketStatsFor(statsWhere) : Promise.resolve(null),
    ])

    return NextResponse.json({ tickets, total, page, pageSize, ...(stats && { stats }) })
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

    // Every ticket has someone responsible for it — there is no unassigned state.
    const assigneeId = data.assigneeId
    if (!assigneeId) {
      return NextResponse.json(
        { error: 'A felelős kiválasztása kötelező — minden feladatnak kell felelőse.' },
        { status: 400 }
      )
    }

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
    if (!(await isEligibleAssignee(assigneeId, target))) {
      return NextResponse.json(
        { error: 'A kiválasztott felelős nem tartozik ehhez a részleghez.' },
        { status: 400 }
      )
    }

    // Categories belong to a single department, so one from elsewhere — or any
    // category at all on a company-wide ticket — is rejected rather than saved.
    if (!(await isValidCategoryForTarget(data.categoryId, target))) {
      return NextResponse.json(
        {
          error: target.visibility === 'COMPANY_WIDE'
            ? 'Teljes céges feladathoz nem választható kategória, mert a kategóriák részlegenként külön állnak.'
            : 'A kiválasztott kategória nem ehhez a részleghez tartozik.',
        },
        { status: 400 }
      )
    }

    const ticket = await prisma.ticket.create({
      data: {
        title: data.title,
        description: data.description,
        priority: data.priority || 'MEDIUM',
        categoryId: data.categoryId || null,
        assigneeId,
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

    // An assignee is mandatory, so there is exactly one person to notify — the
    // former "nobody is responsible, tell the whole department" fan-out is gone
    // along with the case that produced it.
    const notifyUsers = ticket.assignee
      ? [{ id: ticket.assignee.id, email: ticket.assignee.email, name: ticket.assignee.name, nickname: null, firstName: null }]
      : []

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

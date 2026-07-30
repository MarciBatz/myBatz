import { prisma } from './prisma'
import type { Prisma } from '@prisma/client'
import { COMPANY_WIDE } from './departments'

/**
 * The only thing the access rules need about a user. Narrower than SessionUser
 * so callers that legitimately hold just an id+role (e.g. the reminder cron
 * acting on a ticket's assignee) don't have to fabricate a full session object.
 */
export interface AccessActor {
  id: string
  role: string
}

/**
 * Central department access rules. Every server-side query that touches a
 * public ticket (or anything hanging off one) must go through here — the point
 * is that the visibility condition is written once, not re-derived per route
 * where the clauses could drift apart.
 *
 * The model: a ticket is either scoped to exactly one department
 * (visibility DEPARTMENT + departmentId) or visible to everyone
 * (visibility COMPANY_WIDE + departmentId null). A DB CHECK constraint enforces
 * that pairing, so `departmentId === null` is never an ambiguous "unknown".
 */

/** Department ids the user belongs to. Empty for a user with no departments. */
export async function getUserDepartmentIds(userId: string): Promise<string[]> {
  const rows = await prisma.userDepartment.findMany({
    where: { userId },
    select: { departmentId: true },
  })
  return rows.map(r => r.departmentId)
}

/**
 * Prisma `where` fragment restricting tickets to what this user may see.
 * ADMIN gets `{}` (everything). Everyone else sees their departments' tickets
 * plus all company-wide ones — a user with no departments still sees
 * company-wide tickets, which is intentional.
 */
export async function ticketAccessWhere(user: AccessActor): Promise<Prisma.TicketWhereInput> {
  if (user.role === 'ADMIN') return {}
  const departmentIds = await getUserDepartmentIds(user.id)
  return {
    OR: [
      { visibility: 'COMPANY_WIDE' },
      ...(departmentIds.length > 0 ? [{ departmentId: { in: departmentIds } }] : []),
    ],
  }
}

/**
 * Combines the access rule with a route's own filters. Kept as AND so a caller
 * can never accidentally widen access by supplying its own top-level OR.
 */
export async function scopedTicketWhere(
  user: AccessActor,
  filters: Prisma.TicketWhereInput = {}
): Promise<Prisma.TicketWhereInput> {
  const access = await ticketAccessWhere(user)
  if (user.role === 'ADMIN') return filters
  return { AND: [access, filters] }
}

/** True if the user may see this ticket. */
export async function canAccessTicket(user: AccessActor, ticketId: string): Promise<boolean> {
  const where = await scopedTicketWhere(user, { id: ticketId })
  const found = await prisma.ticket.findFirst({ where, select: { id: true } })
  return !!found
}

/**
 * Throws NOT_FOUND when the ticket doesn't exist *or* the user can't see it —
 * deliberately the same error either way, so a 404 never reveals that an
 * inaccessible ticket exists.
 */
export async function assertTicketAccess(user: AccessActor, ticketId: string): Promise<void> {
  if (!(await canAccessTicket(user, ticketId))) throw new Error('NOT_FOUND')
}

export function notFoundResponse(message = 'A feladat nem található') {
  return new Response(JSON.stringify({ error: message }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Departments the user may file tickets under / filter by. ADMIN: all of them. */
export async function getSelectableDepartments(user: AccessActor) {
  if (user.role === 'ADMIN') {
    return prisma.department.findMany({
      select: { id: true, name: true, color: true },
      orderBy: { name: 'asc' },
    })
  }
  const rows = await prisma.userDepartment.findMany({
    where: { userId: user.id },
    select: { department: { select: { id: true, name: true, color: true } } },
    orderBy: { department: { name: 'asc' } },
  })
  return rows.map(r => r.department)
}

/**
 * Validates a requested visibility target for create/update.
 * Returns the fields to persist, or an error message in Hungarian.
 */
export async function resolveTicketTarget(
  user: AccessActor,
  target: { visibility?: string | null; departmentId?: string | null },
  canCreateCompanyWide: boolean
): Promise<
  | { ok: true; visibility: 'DEPARTMENT' | 'COMPANY_WIDE'; departmentId: string | null }
  | { ok: false; error: string }
> {
  if (target.visibility === COMPANY_WIDE) {
    if (!canCreateCompanyWide) {
      return { ok: false, error: 'Nincs jogosultságod teljes céges feladat létrehozására.' }
    }
    return { ok: true, visibility: 'COMPANY_WIDE', departmentId: null }
  }

  const departmentId = target.departmentId
  if (!departmentId) {
    return { ok: false, error: 'A részleg megadása kötelező.' }
  }

  // Re-check membership against the database right now, not against anything
  // the client sent — membership may have changed since the form loaded.
  const allowed = await getSelectableDepartments(user)
  if (!allowed.some(d => d.id === departmentId)) {
    return { ok: false, error: 'Ehhez a részleghez nincs hozzáférésed.' }
  }
  return { ok: true, visibility: 'DEPARTMENT', departmentId }
}

/**
 * Users who may be assigned to (or mentioned on) a ticket with this target.
 * Department tickets: that department's active members, plus ADMINs (who can
 * see every ticket anyway). Company-wide: every active user.
 */
export async function getEligibleTicketUsers(target: {
  visibility: string
  departmentId: string | null
}) {
  const select = {
    id: true, email: true, name: true, firstName: true, lastName: true,
    nickname: true, role: true, avatarUrl: true,
  }
  if (target.visibility === COMPANY_WIDE || !target.departmentId) {
    return prisma.user.findMany({ where: { status: 'ACTIVE' }, select, orderBy: { createdAt: 'asc' } })
  }
  return prisma.user.findMany({
    where: {
      status: 'ACTIVE',
      OR: [
        { role: 'ADMIN' },
        { departments: { some: { departmentId: target.departmentId } } },
      ],
    },
    select,
    orderBy: { createdAt: 'asc' },
  })
}

/** True if this user may be the assignee of a ticket with this target. */
export async function isEligibleAssignee(
  assigneeId: string,
  target: { visibility: string; departmentId: string | null }
): Promise<boolean> {
  if (target.visibility === COMPANY_WIDE || !target.departmentId) {
    const u = await prisma.user.findFirst({ where: { id: assigneeId, status: 'ACTIVE' }, select: { id: true } })
    return !!u
  }
  const u = await prisma.user.findFirst({
    where: {
      id: assigneeId,
      status: 'ACTIVE',
      OR: [
        { role: 'ADMIN' },
        { departments: { some: { departmentId: target.departmentId } } },
      ],
    },
    select: { id: true },
  })
  return !!u
}


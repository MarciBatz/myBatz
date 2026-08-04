/**
 * Server-side rules for per-department categories.
 *
 * Every ticket endpoint and the category endpoints funnel through here, so the
 * "which categories belong where, and who may change them" question is answered
 * in one place — same split and reasoning as lib/departments-access.ts.
 */
import { prisma } from '@/lib/prisma'
import { hasPermission } from '@/lib/permissions'
import { getSelectableDepartments, type AccessActor } from '@/lib/departments-access'

/** The visibility target a ticket has (or is about to have). */
export interface TicketTarget {
  visibility: 'DEPARTMENT' | 'COMPANY_WIDE'
  departmentId: string | null
}

/**
 * Departments whose categories this user may add to or remove from.
 *
 * ADMIN gets every department. Anyone else needs the canManageCategories
 * permission *and* membership: the permission says "you may curate categories",
 * membership says "here". Neither alone is enough.
 */
export async function getManageableDepartments(user: AccessActor) {
  if (user.role !== 'ADMIN') {
    const allowed = await hasPermission(user.id, user.role, 'canManageCategories')
    if (!allowed) return []
  }
  return getSelectableDepartments(user)
}

/** Whether this user may change the category list of one specific department. */
export async function canManageCategoriesIn(user: AccessActor, departmentId: string): Promise<boolean> {
  const departments = await getManageableDepartments(user)
  return departments.some(d => d.id === departmentId)
}

/**
 * Categories offered for a ticket target.
 *
 * A company-wide ticket gets none: a category that belongs to one department
 * says nothing about a ticket that spans the whole company.
 */
export async function getCategoriesForTarget(target: TicketTarget) {
  if (target.visibility === 'COMPANY_WIDE' || !target.departmentId) return []
  return prisma.category.findMany({
    where: { departmentId: target.departmentId },
    select: { id: true, name: true, departmentId: true },
    orderBy: { name: 'asc' },
  })
}

/**
 * Validates a requested category against the target the ticket will have.
 * `null` (no category) is always fine — a category is optional.
 */
export async function isValidCategoryForTarget(
  categoryId: string | null | undefined,
  target: TicketTarget
): Promise<boolean> {
  if (!categoryId) return true
  if (target.visibility === 'COMPANY_WIDE' || !target.departmentId) return false
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { departmentId: true },
  })
  return category?.departmentId === target.departmentId
}

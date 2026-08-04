import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireSession, getSessionFromRequest, unauthorizedResponse, forbiddenResponse } from '@/lib/auth'
import { normalizeDepartmentName } from '@/lib/departments'
import { getSelectableDepartments } from '@/lib/departments-access'
import { getManageableDepartments, canManageCategoriesIn } from '@/lib/categories-access'
import { writeAuditLog } from '@/lib/audit'

const schema = z.object({
  name: z.string().min(1, 'A kategória nevét meg kell adni').max(100),
  departmentId: z.string().min(1, 'A részleg megadása kötelező'),
})

/**
 * GET returns only the categories of departments the caller can see, so the
 * filter bar and the pickers never show another department's list.
 *
 * `forDepartmentId` narrows to one department (the ticket create/edit pickers);
 * it is still intersected with the caller's own scope, so it can only narrow.
 * `manageableDepartments` tells the settings screen which lists it may edit.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireSession(request)
    const scope = await getSelectableDepartments(user)
    const scopeIds = scope.map(d => d.id)

    const requested = request.nextUrl.searchParams.get('forDepartmentId')
    const departmentIds = requested
      ? scopeIds.filter(id => id === requested)
      : scopeIds

    const categories = departmentIds.length === 0 ? [] : await prisma.category.findMany({
      where: { departmentId: { in: departmentIds } },
      select: {
        id: true, name: true, departmentId: true,
        department: { select: { id: true, name: true, color: true } },
        _count: { select: { tickets: true } },
      },
      orderBy: [{ department: { name: 'asc' } }, { name: 'asc' }],
    })

    const manageableDepartments = await getManageableDepartments(user)
    return NextResponse.json({ categories, manageableDepartments })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorizedResponse()
    console.error('Categories GET error:', error)
    return NextResponse.json({ error: 'Nem sikerült betölteni a kategóriákat' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) return unauthorizedResponse()

    const { name, departmentId } = schema.parse(await request.json())

    // Permission and membership are re-checked here against the database, not
    // taken from whatever the form was showing when it loaded.
    if (!(await canManageCategoriesIn(session, departmentId))) {
      return forbiddenResponse('Ehhez a részleghez nem adhatsz hozzá kategóriát.')
    }

    const trimmed = name.trim()
    const nameNormalized = normalizeDepartmentName(trimmed)

    const clash = await prisma.category.findUnique({
      where: { departmentId_nameNormalized: { departmentId, nameNormalized } },
      select: { name: true },
    })
    if (clash) {
      return NextResponse.json(
        { error: `Ebben a részlegben már van ilyen kategória: „${clash.name}”` },
        { status: 400 }
      )
    }

    const category = await prisma.category.create({
      data: { name: trimmed, nameNormalized, departmentId },
      select: {
        id: true, name: true, departmentId: true,
        department: { select: { id: true, name: true, color: true } },
        _count: { select: { tickets: true } },
      },
    })

    await writeAuditLog(session.id, 'category_created', `${category.department.name}: ${category.name}`, request)
    return NextResponse.json({ category }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorizedResponse()
    if (error instanceof Error && error.message === 'FORBIDDEN') return forbiddenResponse()
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || 'Érvénytelen adat' }, { status: 400 })
    }
    console.error('Category POST error:', error)
    return NextResponse.json({ error: 'Nem sikerült létrehozni a kategóriát' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireSession, requireAdmin, unauthorizedResponse, forbiddenResponse } from '@/lib/auth'
import { normalizeDepartmentName } from '@/lib/departments'
import { getSelectableDepartments } from '@/lib/departments-access'
import { writeAuditLog } from '@/lib/audit'

const schema = z.object({
  name: z.string().min(1, 'A részleg nevét meg kell adni').max(80),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Érvénytelen szín'),
})

/**
 * GET returns the departments the caller may work with:
 *  - `departments`: selectable scope (ADMIN: all; others: own memberships) —
 *    what the filter bar and the create form offer.
 *  - `all`: ADMIN only, every department with usage counts for the admin screen.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireSession(request)
    const departments = await getSelectableDepartments(user)

    if (user.role !== 'ADMIN') {
      return NextResponse.json({ departments })
    }

    const all = await prisma.department.findMany({
      select: {
        id: true, name: true, color: true, createdAt: true,
        _count: { select: { members: true, tickets: true } },
      },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json({ departments, all })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorizedResponse()
    console.error('Departments GET error:', error)
    return NextResponse.json({ error: 'Nem sikerült betölteni a részlegeket' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request)
    const { name, color } = schema.parse(await request.json())
    const trimmed = name.trim()
    const nameNormalized = normalizeDepartmentName(trimmed)

    const clash = await prisma.department.findUnique({ where: { nameNormalized }, select: { name: true } })
    if (clash) {
      return NextResponse.json(
        { error: `Már létezik részleg ezzel a névvel: „${clash.name}”` },
        { status: 400 }
      )
    }

    const department = await prisma.department.create({
      data: { name: trimmed, nameNormalized, color },
    })

    await writeAuditLog(admin.id, 'department_created', `Részleg létrehozva: „${trimmed}”`, request)
    return NextResponse.json({ department }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorizedResponse()
    if (error instanceof Error && error.message === 'FORBIDDEN') return forbiddenResponse()
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || 'Érvénytelen adat' }, { status: 400 })
    }
    console.error('Departments POST error:', error)
    return NextResponse.json({ error: 'Nem sikerült létrehozni a részleget' }, { status: 500 })
  }
}

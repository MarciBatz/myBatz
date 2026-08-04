import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest, unauthorizedResponse, forbiddenResponse } from '@/lib/auth'
import { canManageCategoriesIn } from '@/lib/categories-access'
import { writeAuditLog } from '@/lib/audit'

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) return unauthorizedResponse()
    const { id } = await params

    const category = await prisma.category.findUnique({
      where: { id },
      select: {
        name: true, departmentId: true,
        department: { select: { name: true } },
        _count: { select: { tickets: true } },
      },
    })
    // 404 rather than 403 for a category in a department the caller can't reach,
    // so the response doesn't confirm that it exists.
    if (!category) return NextResponse.json({ error: 'A kategória nem található' }, { status: 404 })
    if (!(await canManageCategoriesIn(session, category.departmentId))) {
      return NextResponse.json({ error: 'A kategória nem található' }, { status: 404 })
    }

    await prisma.category.delete({ where: { id } })
    await writeAuditLog(
      session.id,
      'category_deleted',
      `${category.department.name}: ${category.name}${category._count.tickets > 0 ? ` (${category._count.tickets} feladatról lekerült)` : ''}`,
      request
    )
    return NextResponse.json({ success: true, affectedTickets: category._count.tickets })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorizedResponse()
    if (error instanceof Error && error.message === 'FORBIDDEN') return forbiddenResponse()
    console.error('Category DELETE error:', error)
    return NextResponse.json({ error: 'Nem sikerült törölni a kategóriát' }, { status: 500 })
  }
}

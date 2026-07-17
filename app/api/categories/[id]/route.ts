import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest, unauthorizedResponse, forbiddenResponse } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) return unauthorizedResponse()
    const canManage = await hasPermission(session.id, session.role, 'canManageCategories')
    if (!canManage) return forbiddenResponse()
    const { id } = await params
    await prisma.category.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorizedResponse()
    if (error instanceof Error && error.message === 'FORBIDDEN') return forbiddenResponse()
    console.error('Category DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

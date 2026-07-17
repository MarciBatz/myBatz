import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireSession, getSessionFromRequest, unauthorizedResponse, forbiddenResponse } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'

const schema = z.object({ name: z.string().min(1).max(100) })

export async function GET(request: NextRequest) {
  try {
    await requireSession(request)
    const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } })
    return NextResponse.json({ categories })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorizedResponse()
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) return unauthorizedResponse()
    const canManage = await hasPermission(session.id, session.role, 'canManageCategories')
    if (!canManage) return forbiddenResponse()
    const body = await request.json()
    const { name } = schema.parse(body)
    const category = await prisma.category.create({ data: { name } })
    return NextResponse.json({ category }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorizedResponse()
    if (error instanceof Error && error.message === 'FORBIDDEN') return forbiddenResponse()
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || "Validation error" }, { status: 400 })
    console.error('Category POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

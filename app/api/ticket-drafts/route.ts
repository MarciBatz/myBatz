import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession, unauthorizedResponse } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const user = await requireSession(request)
    const drafts = await prisma.ticketDraft.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
    })
    return NextResponse.json({ drafts })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorizedResponse()
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireSession(request)
    const body = await request.json()
    const draft = await prisma.ticketDraft.create({
      data: {
        userId: user.id,
        title: body.title || '',
        description: body.description || '',
        priority: body.priority || 'MEDIUM',
        categoryId: body.categoryId || null,
        assigneeId: body.assigneeId || null,
      },
    })
    return NextResponse.json({ draft }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorizedResponse()
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

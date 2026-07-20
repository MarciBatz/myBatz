import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession, unauthorizedResponse, forbiddenResponse } from '@/lib/auth'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSession(request)
    const { id } = await params
    const body = await request.json()

    const existing = await prisma.ticketDraft.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (existing.userId !== user.id) return forbiddenResponse()

    const draft = await prisma.ticketDraft.update({
      where: { id },
      data: {
        title: body.title ?? existing.title,
        description: body.description ?? existing.description,
        priority: body.priority ?? existing.priority,
        categoryId: body.categoryId !== undefined ? (body.categoryId || null) : existing.categoryId,
        assigneeId: body.assigneeId !== undefined ? (body.assigneeId || null) : existing.assigneeId,
      },
    })
    return NextResponse.json({ draft })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorizedResponse()
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSession(request)
    const { id } = await params

    const existing = await prisma.ticketDraft.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ ok: true })
    if (existing.userId !== user.id) return forbiddenResponse()

    await prisma.ticketDraft.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorizedResponse()
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

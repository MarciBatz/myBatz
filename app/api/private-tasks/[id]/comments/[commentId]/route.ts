import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { unauthorizedResponse, forbiddenResponse } from '@/lib/auth'
import { requirePrivateTaskAccess } from '@/lib/private-tasks-auth'

/**
 * Resolves a comment only when its parent task belongs to the caller. Checking
 * ownership through the parent means a comment id alone is never enough.
 */
async function ownedComment(commentId: string, taskId: string, userId: string) {
  return prisma.privateTaskComment.findFirst({
    where: { id: commentId, privateTaskId: taskId, privateTask: { userId } },
    select: { id: true },
  })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const session = await requirePrivateTaskAccess(request)
    const { id, commentId } = await params

    if (!(await ownedComment(commentId, id, session.id))) {
      return NextResponse.json({ error: 'A bejegyzés nem található' }, { status: 404 })
    }

    const { body } = await request.json()
    if (!body || !String(body).trim()) {
      return NextResponse.json({ error: 'A bejegyzés nem lehet üres' }, { status: 400 })
    }

    const [comment] = await prisma.$transaction([
      prisma.privateTaskComment.update({
        where: { id: commentId },
        data: { body: String(body).trim() },
      }),
      prisma.privateTask.update({ where: { id }, data: { updatedAt: new Date() } }),
    ])

    return NextResponse.json({ comment })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorizedResponse()
    if (error instanceof Error && error.message === 'FORBIDDEN') return forbiddenResponse()
    console.error('Private task comment PUT error:', error)
    return NextResponse.json({ error: 'Nem sikerült menteni a bejegyzést' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const session = await requirePrivateTaskAccess(request)
    const { id, commentId } = await params

    if (!(await ownedComment(commentId, id, session.id))) {
      return NextResponse.json({ error: 'A bejegyzés nem található' }, { status: 404 })
    }

    await prisma.$transaction([
      prisma.privateTaskComment.delete({ where: { id: commentId } }),
      prisma.privateTask.update({ where: { id }, data: { updatedAt: new Date() } }),
    ])

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorizedResponse()
    if (error instanceof Error && error.message === 'FORBIDDEN') return forbiddenResponse()
    console.error('Private task comment DELETE error:', error)
    return NextResponse.json({ error: 'Nem sikerült törölni a bejegyzést' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest, unauthorizedResponse, forbiddenResponse } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const session = await getSessionFromRequest(request)
  if (!session) return unauthorizedResponse()

  const canDelete = await hasPermission(session.id, session.role, 'canDeleteComments')
  if (!canDelete) return forbiddenResponse()

  const { commentId } = await params
  const comment = await prisma.comment.findUnique({ where: { id: commentId } })
  if (!comment) return NextResponse.json({ error: 'Hozzászólás nem található' }, { status: 404 })

  await prisma.comment.delete({ where: { id: commentId } })
  return NextResponse.json({ ok: true })
}

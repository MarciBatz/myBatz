import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest, unauthorizedResponse, forbiddenResponse } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { canAccessTicket, notFoundResponse } from '@/lib/departments-access'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const session = await getSessionFromRequest(request)
  if (!session) return unauthorizedResponse()

  const canDelete = await hasPermission(session.id, session.role, 'canDeleteComments')
  if (!canDelete) return forbiddenResponse()

  const { id, commentId } = await params
  if (!(await canAccessTicket(session, id))) return notFoundResponse()
  const comment = await prisma.comment.findFirst({ where: { id: commentId, ticketId: id } })
  if (!comment) return NextResponse.json({ error: 'Hozzászólás nem található' }, { status: 404 })

  await prisma.comment.delete({ where: { id: commentId } })
  return NextResponse.json({ ok: true })
}

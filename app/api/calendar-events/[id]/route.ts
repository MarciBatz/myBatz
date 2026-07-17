import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest, unauthorizedResponse, forbiddenResponse } from '@/lib/auth'

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(request)
  if (!session) return unauthorizedResponse()

  const { id } = await params
  const event = await prisma.calendarEvent.findUnique({ where: { id } })
  if (!event) return NextResponse.json({ error: 'Nem található' }, { status: 404 })

  if (event.createdById !== session.userId && session.role !== 'ADMIN') return forbiddenResponse()

  await prisma.calendarEvent.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

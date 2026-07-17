import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest, unauthorizedResponse, forbiddenResponse } from '@/lib/auth'

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(request)
  if (!session) return unauthorizedResponse()
  if (session.role !== 'ADMIN') return forbiddenResponse()

  const { id } = await params
  await prisma.changelogEntry.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

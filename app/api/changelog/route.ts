import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest, unauthorizedResponse, forbiddenResponse } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return unauthorizedResponse()

  const entries = await prisma.changelogEntry.findMany({
    orderBy: { publishedAt: 'desc' },
  })
  return NextResponse.json({ entries })
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return unauthorizedResponse()
  if (session.role !== 'ADMIN') return forbiddenResponse()

  const { version, title, content } = await request.json()
  if (!version || !title || !content) {
    return NextResponse.json({ error: 'Hiányzó mezők' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { firstName: true, nickname: true, name: true },
  })
  const authorName = user?.nickname || user?.firstName || user?.name || 'Admin'

  const entry = await prisma.changelogEntry.create({
    data: { version, title, content, authorId: session.id, authorName },
  })
  return NextResponse.json({ entry }, { status: 201 })
}

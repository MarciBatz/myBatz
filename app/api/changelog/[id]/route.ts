import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest, unauthorizedResponse, forbiddenResponse } from '@/lib/auth'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(request)
  if (!session) return unauthorizedResponse()
  if (session.role !== 'ADMIN') return forbiddenResponse()

  const { id } = await params
  const { version, title, content } = await request.json()
  if (!version || !title || !content) {
    return NextResponse.json({ error: 'Hiányzó mezők' }, { status: 400 })
  }

  const existing = await prisma.changelogEntry.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'A bejegyzés nem található' }, { status: 404 })

  // Editing never re-sends notifications — those are only sent at publish time.
  const entry = await prisma.changelogEntry.update({
    where: { id },
    data: { version, title, content },
  })
  return NextResponse.json({ entry })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(request)
  if (!session) return unauthorizedResponse()
  if (session.role !== 'ADMIN') return forbiddenResponse()

  const { id } = await params
  await prisma.changelogEntry.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { unauthorizedResponse, forbiddenResponse } from '@/lib/auth'
import { requirePrivateTaskAccess } from '@/lib/private-tasks-auth'

/** Files a completed task away — only allowed from the Kész column. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePrivateTaskAccess(request)
    const { id } = await params

    const existing = await prisma.privateTask.findFirst({
      where: { id, userId: session.id },
      select: { id: true, column: true, archivedAt: true },
    })
    if (!existing) return NextResponse.json({ error: 'A feladat nem található' }, { status: 404 })
    if (existing.column !== 'DONE') {
      return NextResponse.json({ error: 'Csak Kész feladat archiválható' }, { status: 400 })
    }
    if (existing.archivedAt) {
      return NextResponse.json({ ok: true }) // already archived — idempotent
    }

    await prisma.$transaction([
      prisma.privateTask.update({ where: { id }, data: { archivedAt: new Date() } }),
      prisma.privateTaskEvent.create({ data: { privateTaskId: id, type: 'archived' } }),
    ])

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorizedResponse()
    if (error instanceof Error && error.message === 'FORBIDDEN') return forbiddenResponse()
    console.error('Private task archive error:', error)
    return NextResponse.json({ error: 'Nem sikerült archiválni a feladatot' }, { status: 500 })
  }
}

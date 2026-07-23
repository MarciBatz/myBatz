import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { unauthorizedResponse, forbiddenResponse } from '@/lib/auth'
import { requirePrivateTaskAccess } from '@/lib/private-tasks-auth'
import { isPrivateTaskColumn, type PrivateTaskColumnValue } from '@/lib/private-tasks'
import { logTaskMoved } from '@/lib/private-task-events'

/**
 * Writes the card order of one column. The client sends the column's full id
 * list after a drag; every id is verified to belong to the caller before any
 * write, so a foreign id can't be slipped into the list.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requirePrivateTaskAccess(request)
    const { column, ids } = await request.json()

    if (!isPrivateTaskColumn(column)) {
      return NextResponse.json({ error: 'Ismeretlen oszlop' }, { status: 400 })
    }
    if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string')) {
      return NextResponse.json({ error: 'Hibás sorrend' }, { status: 400 })
    }

    const owned = await prisma.privateTask.findMany({
      where: { id: { in: ids }, userId: session.id },
      select: { id: true, column: true },
    })
    if (owned.length !== ids.length) {
      return NextResponse.json({ error: 'A feladat nem található' }, { status: 404 })
    }

    await prisma.$transaction(
      ids.map((id: string, index: number) =>
        prisma.privateTask.update({ where: { id }, data: { column, position: index } })
      )
    )

    // Log only the cards that actually changed column (reordering within a
    // column isn't a lifecycle event).
    for (const t of owned) {
      if (t.column !== column) {
        await logTaskMoved(t.id, t.column as PrivateTaskColumnValue, column)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorizedResponse()
    if (error instanceof Error && error.message === 'FORBIDDEN') return forbiddenResponse()
    console.error('Private task reorder error:', error)
    return NextResponse.json({ error: 'Nem sikerült menteni a sorrendet' }, { status: 500 })
  }
}

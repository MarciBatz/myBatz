import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { unauthorizedResponse, forbiddenResponse } from '@/lib/auth'
import { requirePrivateTaskAccess } from '@/lib/private-tasks-auth'

/**
 * Archived tasks for the current user, each with its full lifecycle history
 * (events) and progress notes (comments) so the detail view can render one
 * merged timeline. Sorted by completion time (doneAt), newest first, falling
 * back to archivedAt for any legacy task that predates event logging.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requirePrivateTaskAccess(request)

    const tasks = await prisma.privateTask.findMany({
      where: { userId: session.id, archivedAt: { not: null } },
      include: {
        ticket: { select: { id: true, title: true } },
        events: { orderBy: { createdAt: 'asc' } },
        comments: { orderBy: { createdAt: 'asc' } },
      },
    })

    tasks.sort((a, b) => {
      const at = (a.doneAt ?? a.archivedAt!)?.getTime() ?? 0
      const bt = (b.doneAt ?? b.archivedAt!)?.getTime() ?? 0
      return bt - at
    })

    return NextResponse.json({ tasks })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorizedResponse()
    if (error instanceof Error && error.message === 'FORBIDDEN') return forbiddenResponse()
    console.error('Private task archive list error:', error)
    return NextResponse.json({ error: 'Nem sikerült betölteni az archívumot' }, { status: 500 })
  }
}

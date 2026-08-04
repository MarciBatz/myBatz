/**
 * Dashboard counters, computed in one grouped query rather than four COUNTs.
 *
 * Shared by /api/dashboard/stats and the `withStats` flag on /api/tickets, so
 * the numbers can't differ depending on which one the dashboard happened to ask.
 */
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export interface TicketStats {
  open: number
  inProgress: number
  awaiting: number
  closed: number
  total: number
}

export async function ticketStatsFor(where: Prisma.TicketWhereInput): Promise<TicketStats> {
  const rows = await prisma.ticket.groupBy({
    by: ['status'],
    where,
    _count: { _all: true },
  })

  const count = (status: string) => rows.find(r => r.status === status)?._count._all ?? 0
  const open = count('OPEN')
  const inProgress = count('IN_PROGRESS')
  const awaiting = count('AWAITING')
  const closed = count('CLOSED')

  return { open, inProgress, awaiting, closed, total: open + inProgress + awaiting + closed }
}

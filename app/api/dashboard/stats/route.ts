import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { requireSession, unauthorizedResponse } from '@/lib/auth'
import { COMPANY_WIDE } from '@/lib/departments'
import { scopedTicketWhere, getSelectableDepartments } from '@/lib/departments-access'
import { ticketStatsFor } from '@/lib/ticket-stats'

export async function GET(request: NextRequest) {
  try {
    const user = await requireSession(request)

    // Personal counters: the tickets this user is responsible for, narrowed by
    // the same department selection the list uses. Kept identical to the
    // `withStats` branch of /api/tickets, which is what the dashboard actually
    // calls — this endpoint stays so the two can't answer differently.
    const departmentIdsParam = request.nextUrl.searchParams.getAll('departmentIds').filter(Boolean)
    const extra: Prisma.TicketWhereInput[] = [{ assigneeId: user.id }]
    if (departmentIdsParam.length > 0) {
      const selectable = await getSelectableDepartments(user)
      const allowed = new Set(selectable.map(d => d.id))
      const requested = departmentIdsParam.filter(d => allowed.has(d))
      if (requested.length > 0 && requested.length < allowed.size) {
        extra.push({ OR: [{ visibility: COMPANY_WIDE }, { departmentId: { in: requested } }] })
      }
    }
    const base = await scopedTicketWhere(user, { AND: extra })
    return NextResponse.json(await ticketStatsFor(base))
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorizedResponse()
    console.error('Stats error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

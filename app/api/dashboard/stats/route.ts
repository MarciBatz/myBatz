import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession, unauthorizedResponse } from '@/lib/auth'
import { COMPANY_WIDE } from '@/lib/departments'
import { scopedTicketWhere, getSelectableDepartments } from '@/lib/departments-access'
import type { TicketStatus } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const user = await requireSession(request)

    // The counters must reflect exactly the same scope (and the same department
    // narrowing) as the ticket list, or the numbers won't match the rows.
    const departmentIdsParam = request.nextUrl.searchParams.getAll('departmentIds').filter(Boolean)
    const extra: Record<string, unknown>[] = []
    if (departmentIdsParam.length > 0) {
      const selectable = await getSelectableDepartments(user)
      const allowed = new Set(selectable.map(d => d.id))
      const requested = departmentIdsParam.filter(d => allowed.has(d))
      if (requested.length > 0 && requested.length < allowed.size) {
        extra.push({ OR: [{ visibility: COMPANY_WIDE }, { departmentId: { in: requested } }] })
      }
    }
    const base = await scopedTicketWhere(user, extra.length > 0 ? { AND: extra } : {})
    const withStatus = (status: TicketStatus) => ({ AND: [base, { status }] })

    const [open, inProgress, awaiting, closed] = await Promise.all([
      prisma.ticket.count({ where: withStatus('OPEN') }),
      prisma.ticket.count({ where: withStatus('IN_PROGRESS') }),
      prisma.ticket.count({ where: withStatus('AWAITING') }),
      prisma.ticket.count({ where: withStatus('CLOSED') }),
    ])

    return NextResponse.json({ open, inProgress, awaiting, closed, total: open + inProgress + awaiting + closed })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorizedResponse()
    console.error('Stats error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

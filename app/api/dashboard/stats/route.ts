import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession, unauthorizedResponse } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    await requireSession(request)

    const [open, inProgress, awaiting, closed] = await Promise.all([
      prisma.ticket.count({ where: { status: 'OPEN' } }),
      prisma.ticket.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.ticket.count({ where: { status: 'AWAITING' } }),
      prisma.ticket.count({ where: { status: 'CLOSED' } }),
    ])

    return NextResponse.json({ open, inProgress, awaiting, closed, total: open + inProgress + awaiting + closed })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorizedResponse()
    console.error('Stats error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

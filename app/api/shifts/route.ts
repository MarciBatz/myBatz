import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession, unauthorizedResponse } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    await requireSession(request)
    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : null

    const from = month
      ? new Date(year, month - 1, 1)
      : new Date(year, 0, 1)
    const to = month
      ? new Date(year, month, 0, 23, 59, 59)
      : new Date(year, 11, 31, 23, 59, 59)

    const shifts = await prisma.shiftDay.findMany({
      where: { date: { gte: from, lte: to } },
      orderBy: { date: 'asc' },
    })

    return NextResponse.json({ shifts })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorizedResponse()
    return NextResponse.json({ error: 'Szerverhiba' }, { status: 500 })
  }
}

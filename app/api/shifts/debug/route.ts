import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession, unauthorizedResponse } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    await requireSession(request)
    const rows = await prisma.shiftDay.findMany({
      where: { rowIndex: { in: [220, 221, 222, 223, 224, 225] } },
      select: { rowIndex: true, date: true, shopName: true, assignedTo: true, sheetTab: true },
      orderBy: { rowIndex: 'asc' },
    })
    const total = await prisma.shiftDay.count()
    return NextResponse.json({ rows, total })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorizedResponse()
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

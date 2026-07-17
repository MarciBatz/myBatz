import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest, unauthorizedResponse } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return unauthorizedResponse()

  const { searchParams } = new URL(request.url)
  const year = parseInt(searchParams.get('year') || '0')
  const month = parseInt(searchParams.get('month') || '0')

  const where = year && month ? {
    OR: [
      { startDate: { gte: new Date(Date.UTC(year, month - 1, 1)), lt: new Date(Date.UTC(year, month, 1)) } },
      { endDate: { gte: new Date(Date.UTC(year, month - 1, 1)), lt: new Date(Date.UTC(year, month, 1)) } },
      { startDate: { lt: new Date(Date.UTC(year, month - 1, 1)) }, endDate: { gte: new Date(Date.UTC(year, month, 1)) } },
    ],
  } : {}

  const vacations = await prisma.vacation.findMany({
    where,
    include: { user: { select: { id: true, name: true, firstName: true, lastName: true, nickname: true, email: true } } },
    orderBy: { startDate: 'asc' },
  })

  return NextResponse.json({ vacations })
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return unauthorizedResponse()

  const { startDate, endDate, note } = await request.json()
  if (!startDate || !endDate) return NextResponse.json({ error: 'Kezdő és záró dátum kötelező' }, { status: 400 })

  const vacation = await prisma.vacation.create({
    data: { userId: session.id, startDate: new Date(startDate), endDate: new Date(endDate), note: note || null },
    include: { user: { select: { id: true, name: true, firstName: true, nickname: true, email: true } } },
  })

  return NextResponse.json({ vacation }, { status: 201 })
}

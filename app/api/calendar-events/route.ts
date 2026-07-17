import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorizedResponse } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const session = await getSession(request)
  if (!session) return unauthorizedResponse()

  const { searchParams } = new URL(request.url)
  const year = parseInt(searchParams.get('year') || '0')
  const month = parseInt(searchParams.get('month') || '0')

  const where = year && month ? {
    date: {
      gte: new Date(year, month - 1, 1),
      lt: new Date(year, month, 1),
    },
  } : {}

  const events = await prisma.calendarEvent.findMany({
    where,
    include: { createdBy: { select: { firstName: true, name: true, nickname: true, email: true } } },
    orderBy: { date: 'asc' },
  })

  return NextResponse.json({ events })
}

export async function POST(request: NextRequest) {
  const session = await getSession(request)
  if (!session) return unauthorizedResponse()

  const body = await request.json()
  const { title, description, date, type } = body

  if (!title || !date) {
    return NextResponse.json({ error: 'Cím és dátum kötelező' }, { status: 400 })
  }

  const event = await prisma.calendarEvent.create({
    data: {
      title,
      description: description || null,
      date: new Date(date),
      type: type || 'EGYEB',
      createdById: session.userId,
    },
  })

  return NextResponse.json({ event }, { status: 201 })
}

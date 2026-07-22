import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest, unauthorizedResponse } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return unauthorizedResponse()

  const now = new Date()
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1)

  const [shifts, officeWeek, events, vacations] = await Promise.all([
    prisma.shiftDay.findMany({
      where: { date: { gte: todayStart, lte: todayEnd } },
      orderBy: { date: 'asc' },
    }),
    prisma.officeWeek.findFirst({
      where: { weekStart: { lte: todayEnd }, AND: { weekStart: { gte: new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000) } } },
      include: { assignedUser: { select: { id: true, name: true, firstName: true, lastName: true, nickname: true } } },
      orderBy: { weekStart: 'desc' },
    }),
    prisma.calendarEvent.findMany({
      where: { date: { gte: todayStart, lte: todayEnd } },
      include: { createdBy: { select: { id: true, name: true, firstName: true, lastName: true, nickname: true } } },
    }),
    prisma.vacation.findMany({
      where: { startDate: { lte: todayEnd }, endDate: { gte: todayStart } },
      include: { user: { select: { id: true, name: true, firstName: true, lastName: true, nickname: true } } },
    }),
  ])

  // Verify officeWeek actually covers today (Mon–Sun of that week)
  let todayOfficeWeek = null
  if (officeWeek) {
    const ws = new Date(officeWeek.weekStart)
    const we = new Date(ws.getTime() + 7 * 24 * 60 * 60 * 1000 - 1)
    if (todayStart >= ws && todayStart <= we) {
      todayOfficeWeek = officeWeek
    }
  }

  return NextResponse.json({ shifts, officeWeek: todayOfficeWeek, events, vacations })
}

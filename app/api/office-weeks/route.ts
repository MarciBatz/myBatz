import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest, unauthorizedResponse } from '@/lib/auth'
import { generateOfficeWeeks, getMonday } from '@/lib/office-weeks'

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return unauthorizedResponse()

  const { searchParams } = new URL(request.url)
  const year = parseInt(searchParams.get('year') || '0')
  const month = parseInt(searchParams.get('month') || '0')

  // Generate upcoming weeks if needed
  await generateOfficeWeeks(52)

  let weeks: Awaited<ReturnType<typeof prisma.officeWeek.findMany>>
  if (year && month) {
    const monthStart = new Date(Date.UTC(year, month - 1, 1))
    const monthEnd = new Date(Date.UTC(year, month, 0))
    // Weeks that overlap with this month
    const firstMonday = getMonday(monthStart)
    weeks = await prisma.officeWeek.findMany({
      where: {
        weekStart: {
          gte: firstMonday,
          lte: new Date(monthEnd.getTime() + 6 * 24 * 60 * 60 * 1000),
        },
      },
      include: {
        assignedUser: {
          select: { id: true, name: true, firstName: true, lastName: true, nickname: true, email: true },
        },
      },
      orderBy: { weekStart: 'asc' },
    })
  } else {
    weeks = []
  }

  // Also return all active users for the admin change UI
  const users = await prisma.user.findMany({
    where: { status: 'ACTIVE', role: { in: ['ADMIN', 'AGENT'] } },
    orderBy: [{ name: 'asc' }],
    select: { id: true, name: true, firstName: true, lastName: true, nickname: true },
  })

  return NextResponse.json({ weeks, users })
}

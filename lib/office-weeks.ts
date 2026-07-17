import { prisma } from './prisma'

// Reference Monday: first Monday of 2026
const REFERENCE_MONDAY = new Date('2026-01-05T00:00:00.000Z')

export function getMonday(date: Date): Date {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  return d
}

export async function generateOfficeWeeks(weeksAhead = 12) {
  const users = await prisma.user.findMany({
    where: { status: 'ACTIVE', role: { in: ['ADMIN', 'AGENT'] } },
    orderBy: [{ name: 'asc' }],
    select: { id: true, name: true },
  })
  if (users.length === 0) return 0

  const todayMonday = getMonday(new Date())
  let created = 0

  for (let i = 0; i < weeksAhead; i++) {
    const weekStart = new Date(todayMonday)
    weekStart.setUTCDate(todayMonday.getUTCDate() + i * 7)

    const existing = await prisma.officeWeek.findUnique({ where: { weekStart } })
    if (existing) continue

    const weekIndex = Math.round(
      (weekStart.getTime() - REFERENCE_MONDAY.getTime()) / (7 * 24 * 60 * 60 * 1000)
    )
    const userIndex = ((weekIndex % users.length) + users.length) % users.length

    await prisma.officeWeek.create({
      data: { weekStart, assignedUserId: users[userIndex].id },
    })
    created++
  }

  return created
}

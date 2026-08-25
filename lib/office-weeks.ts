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

/** Monday of the week *after* the one containing `date`. */
export function getNextMonday(date: Date): Date {
  const monday = getMonday(date)
  monday.setUTCDate(monday.getUTCDate() + 7)
  return monday
}

/**
 * Rebuilds the rota from next Monday onward.
 *
 * Two things are deliberately out of reach:
 *
 *  - **The running week.** Rebuilding used to start at `gte: thisMonday`, so
 *    the week already under way was deleted and reassigned — someone would find
 *    they were no longer this week's duty person without anyone touching the
 *    schedule. The comment on that code said "future weeks"; now it is one.
 *  - **Hand-picked weeks.** A week set through the UI carries `isManual` and is
 *    shown as "Módosítva", but the old rebuild ignored the flag and wiped the
 *    choice. Those rows are left alone, and generateOfficeWeeks() skips any week
 *    that already exists, so they survive intact.
 */
export async function rebuildFutureOfficeWeeks(weeksAhead = 52) {
  const from = getNextMonday(new Date())
  const { count: removed } = await prisma.officeWeek.deleteMany({
    where: { weekStart: { gte: from }, isManual: false },
  })
  const created = await generateOfficeWeeks(weeksAhead)
  return { removed, created, from }
}

export async function generateOfficeWeeks(weeksAhead = 12) {
  const allUsers = await prisma.user.findMany({
    where: { status: 'ACTIVE', role: { in: ['ADMIN', 'AGENT'] } },
    orderBy: [{ name: 'asc' }],
    select: { id: true, name: true, preferences: { select: { excludeFromOfficeRotation: true } } },
  })
  const users = allUsers.filter(u => !u.preferences?.excludeFromOfficeRotation)
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

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest, unauthorizedResponse, forbiddenResponse } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { generateOfficeWeeks, getMonday } from '@/lib/office-weeks'

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return unauthorizedResponse()

  const canRegen = await hasPermission(session.id, session.role, 'canRegenerateOfficeSchedule')
  if (!canRegen) return forbiddenResponse()

  const thisMonday = getMonday(new Date())
  await prisma.officeWeek.deleteMany({ where: { weekStart: { gte: thisMonday } } })
  const created = await generateOfficeWeeks(52)

  return NextResponse.json({ ok: true, created })
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from '@/lib/auth'
import { writeAuditLog } from '@/lib/audit'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let admin
  try {
    admin = await requireAdmin(request)
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') return unauthorizedResponse()
    return forbiddenResponse()
  }

  const { id } = await params
  const { assignedUserId } = await request.json()

  // Read the previous holder first: once updated there is nothing left to say
  // who the week was taken from, and the Napló entry is the only record of it.
  const before = await prisma.officeWeek.findUnique({
    where: { id },
    select: { weekStart: true, assignedUser: { select: { name: true, email: true } } },
  })

  const week = await prisma.officeWeek.update({
    where: { id },
    data: { assignedUserId, isManual: true },
    include: {
      assignedUser: {
        select: { id: true, name: true, firstName: true, lastName: true, nickname: true, email: true },
      },
    },
  })

  const who = (u: { name: string | null; email: string } | null | undefined) =>
    u?.name || u?.email || 'senki'
  await writeAuditLog(
    admin.id,
    'office_week_assigned',
    `${week.weekStart.toISOString().slice(0, 10)} hét irodai hetese: ${who(before?.assignedUser)} → ${who(week.assignedUser)}`,
    request
  )

  return NextResponse.json({ week })
}

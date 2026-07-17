import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from '@/lib/auth'
import { sendOfficeWeekReminderEmail } from '@/lib/email'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request)
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') return unauthorizedResponse()
    return forbiddenResponse()
  }

  const { id } = await params
  const week = await prisma.officeWeek.findUnique({
    where: { id },
    include: { assignedUser: { select: { email: true, name: true, firstName: true, nickname: true } } },
  })

  if (!week?.assignedUser) return NextResponse.json({ error: 'Nincs hozzárendelt felhasználó' }, { status: 400 })

  await sendOfficeWeekReminderEmail(week.assignedUser, new Date(week.weekStart))
  return NextResponse.json({ ok: true, sentTo: week.assignedUser.email })
}

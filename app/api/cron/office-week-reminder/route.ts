import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendOfficeWeekReminderEmail } from '@/lib/email'
import { getMonday } from '@/lib/office-weeks'

export async function GET(_request: NextRequest) {
  const thisMonday = getMonday(new Date())

  const week = await prisma.officeWeek.findUnique({
    where: { weekStart: thisMonday },
    include: {
      assignedUser: {
        select: { email: true, name: true, firstName: true, lastName: true, nickname: true },
      },
    },
  })

  if (!week?.assignedUser) {
    return NextResponse.json({ ok: true, message: 'No assigned user for this week' })
  }

  await sendOfficeWeekReminderEmail(week.assignedUser, thisMonday)

  return NextResponse.json({ ok: true, sentTo: week.assignedUser.email })
}

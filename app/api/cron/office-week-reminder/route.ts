import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendOfficeWeekReminderEmail } from '@/lib/email'
import { getMonday } from '@/lib/office-weeks'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const thisMonday = getMonday(new Date())

  const week = await prisma.officeWeek.findUnique({
    where: { weekStart: thisMonday },
    include: {
      assignedUser: {
        select: { email: true, name: true, firstName: true, nickname: true },
      },
    },
  })

  if (!week?.assignedUser) {
    return NextResponse.json({ ok: true, message: 'No assigned user for this week' })
  }

  await sendOfficeWeekReminderEmail(week.assignedUser, thisMonday)

  return NextResponse.json({ ok: true, sentTo: week.assignedUser.email })
}

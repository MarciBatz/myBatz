import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireReadWrite, unauthorizedResponse , forbiddenResponse} from '@/lib/auth'
import { fullDisplayName } from '@/lib/utils'
import { sendNudgeEmail } from '@/lib/email'
import { canAccessTicket, notFoundResponse } from '@/lib/departments-access'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireReadWrite(request)
    const { id } = await params

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        assignee: { select: { id: true, email: true, name: true, nickname: true } },
      },
    })

    if (!ticket || !(await canAccessTicket(user, id))) return notFoundResponse()
    if (!ticket.assignee) return NextResponse.json({ error: 'A ticketnek nincs felelőse' }, { status: 400 })
    if (ticket.assignee.id === user.id) return NextResponse.json({ error: 'Saját magadnak nem küldhetsz emlékeztetőt' }, { status: 400 })

    await sendNudgeEmail(ticket.assignee, { id, title: ticket.title }, fullDisplayName(user))

    const assigneeName = fullDisplayName(ticket.assignee)

    await prisma.activityLog.create({
      data: {
        ticketId: id,
        userId: user.id,
        action: 'nudge_sent',
        newValue: assigneeName,
      },
    })

    await prisma.notificationLog.create({
      data: {
        userId: ticket.assignee.id,
        ticketId: id,
        type: 'nudge',
        message: `${fullDisplayName(user)} jelezte, hogy foglalkozni kell ezzel: "${ticket.title}"`,
        link: `/tickets/${id}`,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorizedResponse()
    if (error instanceof Error && error.message === 'FORBIDDEN') return forbiddenResponse('Ehhez a művelethez nincs jogosultságod.')
    console.error('Nudge error:', error)
    return NextResponse.json({ error: 'Szerverhiba történt' }, { status: 500 })
  }
}

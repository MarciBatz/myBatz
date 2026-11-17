import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireReadWrite, unauthorizedResponse, forbiddenResponse } from '@/lib/auth'
import { canAccessTicket, notFoundResponse } from '@/lib/departments-access'
import { canRemoveCollaborator } from '@/lib/ticket-collaborators'
import { fullDisplayName } from '@/lib/utils'

/**
 * Takes a collaborator off the ticket. Anyone may take themselves off;
 * removing someone else is for the creator, the assignee and ADMIN.
 *
 * Access is checked before the removal, not after — once the row is gone the
 * remover may no longer be able to see the ticket themselves, if that
 * collaboration was their own way in.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const user = await requireReadWrite(request)
    const { id, userId } = await params

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      select: { id: true, title: true, createdById: true, assigneeId: true },
    })
    if (!ticket || !(await canAccessTicket(user, id))) return notFoundResponse()

    if (!canRemoveCollaborator(user, ticket, userId)) {
      return forbiddenResponse('Csak a feladat létrehozója, felelőse vagy adminisztrátor kapcsolhat le másik kollégát.')
    }

    const existing = await prisma.ticketCollaborator.findUnique({
      where: { ticketId_userId: { ticketId: id, userId } },
      select: {
        id: true,
        user: { select: { id: true, email: true, name: true, firstName: true, lastName: true, nickname: true } },
      },
    })
    // Not on the ticket: the end state is the one that was asked for, so this
    // is reported as done rather than as a failure.
    if (!existing) return NextResponse.json({ ok: true, alreadyAbsent: true })

    await prisma.ticketCollaborator.delete({ where: { id: existing.id } })

    const isSelf = userId === user.id
    await prisma.activityLog.create({
      data: {
        ticketId: id,
        userId: user.id,
        action: isSelf ? 'collaborator_left' : 'collaborator_removed',
        oldValue: fullDisplayName(existing.user) || existing.user.email,
      },
    })

    // Being taken off a ticket by someone else means losing sight of it, which
    // is worth a notice; walking away yourself is not.
    if (!isSelf) {
      await prisma.notificationLog.create({
        data: {
          userId,
          ticketId: id,
          type: 'collaborator_removed',
          message: `${fullDisplayName(user) || user.email} lekapcsolt a feladatról: "${ticket.title}"`,
          // No link on purpose: if that collaboration was their only way in,
          // the ticket is now a 404 for them, and a notice that leads nowhere
          // reads as a broken app rather than as "you are no longer on this".
          link: null,
        },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorizedResponse()
    console.error('Collaborator DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireSession, requireReadWrite, unauthorizedResponse, forbiddenResponse } from '@/lib/auth'
import { canAccessTicket, notFoundResponse } from '@/lib/departments-access'
import {
  canManageCollaborators, canJoinSelf, getCollaboratorCandidates,
  COLLABORATOR_USER_SELECT,
} from '@/lib/ticket-collaborators'
import { sendTicketCollaboratorAddedEmail } from '@/lib/email'
import { fullDisplayName } from '@/lib/utils'

const addSchema = z.object({ userId: z.string().min(1) })

/**
 * The people who could still be added. Only for those who may actually add
 * someone — handing the full staff list to everyone who can open a ticket
 * would make it a directory endpoint.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSession(request)
    const { id } = await params

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      select: { id: true, createdById: true, assigneeId: true },
    })
    if (!ticket || !(await canAccessTicket(user, id))) return notFoundResponse()

    if (!canManageCollaborators(user, ticket)) {
      return NextResponse.json({ candidates: [] })
    }
    return NextResponse.json({ candidates: await getCollaboratorCandidates(id, ticket.assigneeId) })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorizedResponse()
    console.error('Collaborators GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Adds a collaborator. Two different acts share this endpoint, with different
 * rules: joining yourself needs only access to the ticket, while pulling
 * someone else in is restricted to the creator, the assignee and ADMIN —
 * because that hands out access to a ticket they may not otherwise see.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireReadWrite(request)
    const { id } = await params
    const { userId } = addSchema.parse(await request.json())

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      select: { id: true, title: true, dueDate: true, createdById: true, assigneeId: true },
    })
    if (!ticket || !(await canAccessTicket(user, id))) return notFoundResponse()

    const isSelf = userId === user.id
    if (isSelf) {
      if (!canJoinSelf(user)) {
        return forbiddenResponse('Megtekintői jogosultsággal nem lehet rákapcsolódni feladatra.')
      }
    } else if (!canManageCollaborators(user, ticket)) {
      return forbiddenResponse('Csak a feladat létrehozója, felelőse vagy adminisztrátor kapcsolhat rá másik kollégát.')
    }

    // The assignee is on the ticket by definition; a second entry would show
    // the same person twice and imply they could be removed from their own work.
    if (ticket.assigneeId === userId) {
      return NextResponse.json(
        { error: 'Ez a kolléga a feladat felelőse, már dolgozik rajta.' },
        { status: 400 }
      )
    }

    const target = await prisma.user.findFirst({
      where: { id: userId, status: 'ACTIVE' },
      select: { ...COLLABORATOR_USER_SELECT, firstName: true },
    })
    if (!target) {
      return NextResponse.json({ error: 'A kolléga nem található vagy nem aktív.' }, { status: 400 })
    }
    if (target.role === 'READER') {
      return NextResponse.json(
        { error: 'Megtekintői jogosultságú kollégát nem lehet rákapcsolni feladatra.' },
        { status: 400 }
      )
    }

    const existing = await prisma.ticketCollaborator.findUnique({
      where: { ticketId_userId: { ticketId: id, userId } },
      select: { id: true },
    })
    // Already on it: nothing to do, and not an error — two people pressing the
    // button at once should not produce a failure for one of them.
    if (existing) {
      return NextResponse.json({ ok: true, alreadyPresent: true })
    }

    const collaborator = await prisma.ticketCollaborator.create({
      data: { ticketId: id, userId, addedById: isSelf ? null : user.id },
      select: { id: true, createdAt: true, addedById: true, user: { select: COLLABORATOR_USER_SELECT } },
    })

    const actorName = fullDisplayName(user) || user.email
    await prisma.activityLog.create({
      data: {
        ticketId: id,
        userId: user.id,
        action: isSelf ? 'collaborator_joined' : 'collaborator_added',
        newValue: fullDisplayName(target) || target.email,
      },
    })

    // Only when someone else did it: telling people what they just did
    // themselves is noise, and a self-join needs no access notice.
    if (!isSelf) {
      await prisma.notificationLog.create({
        data: {
          userId,
          ticketId: id,
          type: 'collaborator_added',
          message: `${actorName} rákapcsolt a feladatra: "${ticket.title}"`,
          link: `/tickets/${id}`,
        },
      })
      try {
        await sendTicketCollaboratorAddedEmail(target, ticket, actorName)
      } catch (e) {
        // The collaboration itself must stand even if the mail cannot go out.
        console.error('Collaborator email error:', e)
      }
    }

    return NextResponse.json({ ok: true, collaborator })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorizedResponse()
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || 'Validation error' }, { status: 400 })
    }
    console.error('Collaborators POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

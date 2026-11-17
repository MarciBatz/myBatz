/**
 * Extra colleagues on a public ticket.
 *
 * A ticket still has exactly one assignee. A collaborator is "who else is on
 * it": someone who joined, or who the creator/assignee pulled in for help.
 *
 * Collaborating *grants access* to the ticket — see the collaborator clause in
 * ticketAccessWhere. That is deliberate (help can come from another
 * department), and it is why the rules for who may add someone live here in one
 * place rather than being re-derived per route.
 */
import { prisma } from './prisma'
import type { AccessActor } from './departments-access'

/** The user fields every collaborator surface needs. */
export const COLLABORATOR_USER_SELECT = {
  id: true, email: true, name: true, firstName: true, lastName: true,
  nickname: true, avatarUrl: true, role: true,
} as const

/** What the rules need to know about a ticket. */
export interface CollaboratorTicket {
  createdById: string | null
  assigneeId: string | null
}

/**
 * May this actor pull *other* people onto the ticket, or take them off?
 *
 * Creator, current assignee and ADMIN. The assignee is included because they
 * are the one doing the work and so the one who notices help is needed;
 * without them, asking for a hand would mean asking the creator to ask.
 *
 * Joining or leaving by oneself is a different question — see
 * canJoinSelf/canRemove below.
 */
export function canManageCollaborators(actor: AccessActor, ticket: CollaboratorTicket): boolean {
  if (actor.role === 'ADMIN') return true
  return ticket.createdById === actor.id || ticket.assigneeId === actor.id
}

/**
 * May this actor take this particular person off the ticket?
 *
 * Anyone may take themselves off, whoever added them: a collaboration is work,
 * not an obligation someone else gets to keep you in.
 */
export function canRemoveCollaborator(
  actor: AccessActor,
  ticket: CollaboratorTicket,
  targetUserId: string
): boolean {
  if (targetUserId === actor.id) return true
  return canManageCollaborators(actor, ticket)
}

/**
 * READER is read-only everywhere else, so it cannot join either — joining
 * announces that you are working on something, and a READER cannot comment or
 * change a field.
 */
export function canJoinSelf(actor: AccessActor): boolean {
  return actor.role !== 'READER'
}

/**
 * Active users who can still be added: everyone except the assignee (already on
 * it by definition) and the people already added.
 *
 * Deliberately *not* getEligibleTicketUsers: that list is a department's
 * members, and the reason to add a collaborator is often that the help is
 * outside the department. The access grant is the feature, so the candidate
 * list has to be wider than the ticket's own visibility.
 */
export async function getCollaboratorCandidates(ticketId: string, assigneeId: string | null) {
  const existing = await prisma.ticketCollaborator.findMany({
    where: { ticketId },
    select: { userId: true },
  })
  const taken = new Set(existing.map(r => r.userId))
  if (assigneeId) taken.add(assigneeId)

  const users = await prisma.user.findMany({
    where: { status: 'ACTIVE', role: { not: 'READER' } },
    select: COLLABORATOR_USER_SELECT,
    orderBy: { createdAt: 'asc' },
  })
  return users.filter(u => !taken.has(u.id))
}

type Recipient = {
  id: string
  email: string
  name: string | null
  firstName: string | null
  nickname: string | null
}

/**
 * Who to tell about activity on a ticket: assignee, creator and collaborators.
 *
 * This is the set the comment and field-change emails already used (assignee +
 * creator) with collaborators added — being on a ticket and hearing nothing
 * about it would make joining pointless.
 */
export async function getActivityRecipients(
  ticketId: string,
  excludeUserId?: string
): Promise<Recipient[]> {
  return collectRecipients(ticketId, { includeCreator: true, excludeUserId })
}

/**
 * Who to remind about a deadline: assignee and collaborators — the people
 * actually working on it.
 *
 * The creator is left out on purpose. Someone who files many tickets would get
 * a mail for every deadline on all of them, and a reminder that arrives for
 * work you are not doing is the kind that teaches people to filter the sender.
 * A creator who is still involved will be the assignee or a collaborator, and
 * is then included for that reason.
 */
export async function getDeadlineRecipients(
  ticketId: string,
  excludeUserId?: string
): Promise<Recipient[]> {
  return collectRecipients(ticketId, { includeCreator: false, excludeUserId })
}

async function collectRecipients(
  ticketId: string,
  opts: { includeCreator: boolean; excludeUserId?: string }
): Promise<Recipient[]> {
  const select = { id: true, email: true, name: true, firstName: true, nickname: true }
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      assignee: { select },
      createdBy: { select },
      collaborators: { select: { user: { select } } },
    },
  })
  if (!ticket) return []

  // A Map keyed by id, so the same person holding two roles is mailed once.
  const byId = new Map<string, Recipient>()
  const add = (u: Recipient | null) => {
    if (!u || !u.email) return
    if (opts.excludeUserId && u.id === opts.excludeUserId) return
    byId.set(u.id, u)
  }

  add(ticket.assignee)
  if (opts.includeCreator) add(ticket.createdBy)
  for (const c of ticket.collaborators) add(c.user)

  return Array.from(byId.values())
}

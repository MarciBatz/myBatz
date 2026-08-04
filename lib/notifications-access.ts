/**
 * Shared scope for a user's notifications.
 *
 * Both the notifications list and the sidebar's unread badge (which rides along
 * with the heartbeat) count the same rows, so the filter lives here rather than
 * being written twice and drifting apart.
 */
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ticketAccessWhere, type AccessActor } from '@/lib/departments-access'

/**
 * Notifications always hang off a ticket, so an older notification must stop
 * being listed once the user loses access to that ticket's department —
 * otherwise its title and link would keep leaking.
 */
export async function notificationScope(user: AccessActor): Promise<Prisma.NotificationLogWhereInput> {
  const access = await ticketAccessWhere(user)
  return {
    userId: user.id,
    message: { not: null },
    ...(user.role !== 'ADMIN' && { ticket: access }),
  }
}

/** Just the badge number — no rows fetched. */
export async function countUnreadNotifications(user: AccessActor): Promise<number> {
  const scope = await notificationScope(user)
  return prisma.notificationLog.count({ where: { ...scope, read: false } })
}

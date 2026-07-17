import { prisma } from './prisma'

export type PermissionKey =
  | 'canRegenerateOfficeSchedule'
  | 'canManageEmailNotifications'
  | 'canSendInvites'
  | 'canDeleteTickets'
  | 'canDeleteComments'
  | 'canManageCategories'

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  canRegenerateOfficeSchedule: 'Irodai hetes beosztás újragenerálása',
  canManageEmailNotifications: 'E-mail értesítési beállítások módosítása',
  canSendInvites: 'Meghívó küldése',
  canDeleteTickets: 'Ticketek törlése',
  canDeleteComments: 'Hozzászólások törlése',
  canManageCategories: 'Kategóriák kezelése',
}

export async function hasPermission(
  userId: string,
  role: string,
  permission: PermissionKey
): Promise<boolean> {
  if (role === 'ADMIN') return true
  const perms = await prisma.userPermissions.findUnique({ where: { userId } })
  if (!perms) return false
  return perms[permission] === true
}

// Check if user should receive a specific notification type
export async function userWantsNotification(
  userId: string,
  type: 'tickets' | 'calendarSzuronap' | 'calendarHetes' | 'calendarEgyeb'
): Promise<boolean> {
  const prefs = await prisma.userPreferences.findUnique({ where: { userId } })
  if (!prefs) return true // default: all on
  const map = {
    tickets: prefs.notifyTickets,
    calendarSzuronap: prefs.notifyCalendarSzuronap,
    calendarHetes: prefs.notifyCalendarHetes,
    calendarEgyeb: prefs.notifyCalendarEgyeb,
  }
  return map[type]
}

export function displayName(user: { nickname?: string | null; firstName?: string | null; name?: string | null; email?: string }): string {
  if (user.nickname) return user.nickname
  if (user.firstName) return user.firstName
  if (user.name) return user.name.split(' ').slice(1).join(' ') || user.name.split(' ')[0]
  return user.email?.split('@')[0] || ''
}

export function fullDisplayName(user: { nickname?: string | null; lastName?: string | null; firstName?: string | null; name?: string | null; email?: string }): string {
  if (user.nickname) return user.nickname
  if (user.lastName && user.firstName) return `${user.lastName} ${user.firstName}`
  if (user.name) return user.name
  return user.email?.split('@')[0] || ''
}

type NameableUser = { id: string; nickname?: string | null; lastName?: string | null; firstName?: string | null; name?: string | null; email?: string }

/**
 * Names for a list of people, disambiguated. Built on fullDisplayName, so the
 * usual result is already the full name; this only matters when two people
 * share a nickname, where it falls back to the full name for both.
 */
export function buildUniqueDisplayNames(users: NameableUser[]): Record<string, string> {
  const preferred = new Map(users.map(u => [u.id, fullDisplayName(u)]))
  const counts = new Map<string, number>()
  preferred.forEach(n => counts.set(n, (counts.get(n) || 0) + 1))
  const result: Record<string, string> = {}
  users.forEach(u => {
    const pref = preferred.get(u.id)!
    const fallback = (u.lastName && u.firstName) ? `${u.lastName} ${u.firstName}` : (u.name || u.email?.split('@')[0] || '')
    result[u.id] = (counts.get(pref)! > 1) ? fallback : pref
  })
  return result
}

// Escapes HTML, then applies the changelog's inline **bold** markup.
// Shared by the changelog page and the changelog email so the two can't drift apart.
export function renderInlineMarkup(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}

export function formatRelativeTime(date: Date | string): string {
  const d = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffSec < 60) return 'most'
  if (diffMin < 60) return `${diffMin} perce`
  if (diffHr < 24) return `${diffHr} órája`
  if (diffDay < 7) return `${diffDay} napja`
  return d.toLocaleDateString('hu-HU', { day: 'numeric', month: 'long', year: diffDay > 365 ? 'numeric' : undefined })
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' })
}

export function formatDateTime(date: Date | string): string {
  return new Date(date).toLocaleString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// A user is considered online if their last heartbeat was within this window.
// The heartbeat fires every 60s (see Sidebar), so 2 minutes tolerates one miss.
export const ONLINE_THRESHOLD_MS = 2 * 60 * 1000

export function isOnline(lastSeenAt: string | Date | null | undefined): boolean {
  if (!lastSeenAt) return false
  return Date.now() - new Date(lastSeenAt).getTime() < ONLINE_THRESHOLD_MS
}

// Bare relative label — "Most online", "3 perce", "2 órája", "5 napja", "Soha".
// Used directly under the "Utoljára aktív" table header; callers that want the
// "Utoljára … online" phrasing (ticket profile cards) compose it themselves.
export function formatLastSeen(lastSeenAt: string | Date | null | undefined): string {
  if (!lastSeenAt) return 'Soha'
  const diff = Date.now() - new Date(lastSeenAt).getTime()
  if (diff < ONLINE_THRESHOLD_MS) return 'Most online'
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)} perce`
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)} órája`
  return `${Math.floor(diff / 86400000)} napja`
}

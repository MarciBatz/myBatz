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

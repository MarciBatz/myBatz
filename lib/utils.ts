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

  if (diffSec < 60) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: diffDay > 365 ? 'numeric' : undefined })
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatDateTime(date: Date | string): string {
  return new Date(date).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

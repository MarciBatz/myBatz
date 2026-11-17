import { formatDate } from '@/lib/utils'

/**
 * A ticket's deadline, with the urgency it actually carries.
 *
 * The comparison is done in whole UTC days against the stored date, which is
 * written as UTC midnight from a date-only input. Comparing instants instead
 * would make "today" turn red or not depending on the hour the page is opened.
 *
 * Closed tickets get the plain grey treatment: a missed deadline on finished
 * work is history, and colouring it red would keep drawing the eye to
 * something nobody needs to act on.
 */
export default function DueDateChip({
  dueDate,
  closed = false,
  className = '',
}: {
  dueDate: string | null | undefined
  closed?: boolean
  className?: string
}) {
  if (!dueDate) return null

  const due = new Date(dueDate)
  if (Number.isNaN(due.getTime())) return null

  const now = new Date()
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const dueUtc = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate())
  const days = Math.round((dueUtc - todayUtc) / 86400000)

  const tone = closed ? 'past'
    : days < 0 ? 'overdue'
    : days === 0 ? 'today'
    : days <= 2 ? 'soon'
    : 'future'

  const styles: Record<string, string> = {
    overdue: 'bg-red-50 text-red-700',
    today: 'bg-amber-100 text-amber-800',
    soon: 'bg-amber-50 text-amber-700',
    future: 'bg-gray-100 text-gray-600',
    past: 'bg-gray-100 text-gray-500',
  }

  const label = closed ? formatDate(dueDate)
    : days < 0 ? `${formatDate(dueDate)} — ${Math.abs(days)} napja lejárt`
    : days === 0 ? `${formatDate(dueDate)} — ma`
    : days === 1 ? `${formatDate(dueDate)} — holnap`
    : formatDate(dueDate)

  return (
    <span
      title={`Határidő: ${formatDate(dueDate)}`}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-medium whitespace-nowrap ${styles[tone]} ${className}`}
    >
      <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      {label}
    </span>
  )
}

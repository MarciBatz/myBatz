import { badgeColors, COMPANY_WIDE_LABEL, COMPANY_WIDE_COLOR } from '@/lib/departments'

export interface TicketDepartmentInfo {
  visibility: string
  department?: { id: string; name: string; color: string } | null
}

/**
 * Department (or "Teljes cég") label for a ticket.
 *
 * The name is always rendered as text, never colour alone, so the badge still
 * carries its meaning for colour-blind users and in high-contrast modes. The
 * colour pair comes from badgeColors(), which guarantees WCAG AA (4.5:1) for the
 * 12px label whatever colour an admin picked, in both light and dark themes.
 */
export default function DepartmentBadge({
  visibility,
  department,
  size = 'sm',
}: TicketDepartmentInfo & { size?: 'xs' | 'sm' }) {
  const companyWide = visibility === 'COMPANY_WIDE'
  const label = companyWide ? COMPANY_WIDE_LABEL : (department?.name ?? '—')
  const { background: bg, text: fg } =
    badgeColors(companyWide ? COMPANY_WIDE_COLOR : (department?.color ?? '#6B7280'))
  const pad = size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md font-medium whitespace-nowrap ${pad}`}
      style={{ background: bg, color: fg }}
      title={companyWide ? 'Ez a feladat a teljes cég számára látható' : `Részleg: ${label}`}
    >
      {companyWide && (
        <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )}
      {label}
    </span>
  )
}

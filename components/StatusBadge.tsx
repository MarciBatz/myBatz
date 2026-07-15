const config: Record<string, { bg: string; text: string; label: string }> = {
  OPEN: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Nyitott' },
  IN_PROGRESS: { bg: 'bg-indigo-100', text: 'text-indigo-700', label: 'Folyamatban' },
  AWAITING: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Várakozó' },
  CLOSED: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Lezárt' },
}

export default function StatusBadge({ status }: { status: string }) {
  const c = config[status] || config.OPEN
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  )
}

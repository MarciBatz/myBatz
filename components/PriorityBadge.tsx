const config: Record<string, { bg: string; text: string; label: string }> = {
  CRITICAL: { bg: 'bg-red-100', text: 'text-red-700', label: 'Kritikus' },
  HIGH: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Magas' },
  MEDIUM: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Közepes' },
  LOW: { bg: 'bg-green-100', text: 'text-green-700', label: 'Alacsony' },
}

export default function PriorityBadge({ priority }: { priority: string }) {
  const c = config[priority] || config.MEDIUM
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  )
}

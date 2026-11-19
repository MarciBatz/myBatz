import DepartmentBadge from './DepartmentBadge'
import PriorityBadge from './PriorityBadge'
import DueDateChip from './DueDateChip'

/**
 * The context line under a ticket's title: which department and category it
 * belongs to, how urgent it is, and when it is due.
 *
 * These used to be four fixed columns. They are identifiers rather than things
 * you compare row against row — in practice most rows share a department and a
 * priority — so a column each spent ~440px on repetition and pushed the rest of
 * the table off screen. Here they cost nothing: the cell's width is set by the
 * title above, and the chips wrap underneath it.
 *
 * One component for both the table and the phone card, so the two views can't
 * drift apart.
 */
export default function TicketChips({
  visibility,
  department,
  category,
  priority,
  dueDate,
  closed,
  size = 'sm',
}: {
  visibility: string
  department?: { id: string; name: string; color: string } | null
  category?: { id: string; name: string } | null
  priority: string
  dueDate?: string | null
  closed?: boolean
  size?: 'xs' | 'sm'
}) {
  const pad = size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <DepartmentBadge visibility={visibility} department={department} size={size} />
      {category && (
        <span className={`inline-flex items-center rounded-md font-medium whitespace-nowrap bg-purple-50 text-purple-700 ${pad}`}>
          {category.name}
        </span>
      )}
      <PriorityBadge priority={priority} />
      <DueDateChip dueDate={dueDate} closed={closed} />
    </div>
  )
}

/**
 * Filtering and ordering for the private task board and its calendar.
 *
 * Client-safe (no Prisma): the whole task list already arrives in one request,
 * so this happens in the browser and reacts instantly instead of costing a
 * round trip per change.
 */
import type { PrivateTask, PrivateTaskColumnValue } from './private-tasks'

/** Which date a period refers to. */
export type DateBasis = 'dueDate' | 'createdAt'

/**
 * Period values carry the field they refer to, so one dropdown says both
 * "how long" and "which date" — no separate basis toggle to keep in sync.
 */
export type Period =
  | 'all'
  | 'due:today' | 'due:week' | 'due:month' | 'due:custom'
  | 'created:today' | 'created:week' | 'created:month' | 'created:custom'

export type SortKey = 'manual' | 'dueDate' | 'createdAt' | 'priority'

export interface PrivateTaskFilters {
  period: Period
  /** yyyy-mm-dd, only used by the custom periods. Either end may be empty. */
  from: string
  to: string
  priorities: string[]
  columns: string[]
  includeArchived: boolean
  sort: SortKey
}

/**
 * The view always opens on everything, in the order the cards were dragged
 * into. Filters are deliberately *not* persisted: a saved filter would mean
 * coming back to a board that silently hides tasks, which is exactly the way
 * to forget one.
 */
export const EMPTY_FILTERS: PrivateTaskFilters = {
  period: 'all',
  from: '',
  to: '',
  priorities: [],
  columns: [],
  includeArchived: false,
  sort: 'manual',
}

export function isFilterActive(f: PrivateTaskFilters): boolean {
  return f.period !== 'all'
    || f.priorities.length > 0
    || f.columns.length > 0
    || f.includeArchived
    || f.sort !== 'manual'
}

/** The date field a period refers to; null when no period is set. */
export function periodBasis(period: Period): DateBasis | null {
  if (period === 'all') return null
  return period.startsWith('created:') ? 'createdAt' : 'dueDate'
}

/** Local calendar day as yyyy-mm-dd. */
export function localDayKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * The day a task belongs to, as yyyy-mm-dd — or null if it has no such date.
 *
 * The two bases are read differently on purpose. `dueDate` is written from an
 * <input type="date">, so it is a calendar day rather than a moment, and its
 * UTC day is the day the person picked; reading it in local time would drag it
 * a day backwards for anyone behind UTC. `createdAt` is a real instant, so the
 * day it belongs to is the local one — a task created at half past midnight
 * belongs to that night, not to the day before.
 */
export function taskDayKey(task: FilterableTask, basis: DateBasis): string | null {
  if (basis === 'dueDate') return task.dueDate ? task.dueDate.slice(0, 10) : null
  return localDayKey(new Date(task.createdAt))
}

/** Monday of the week containing `d`, in local time. */
export function startOfWeek(d: Date): Date {
  const out = new Date(d)
  out.setHours(0, 0, 0, 0)
  const day = out.getDay() // 0 = Sunday
  out.setDate(out.getDate() + (day === 0 ? -6 : 1 - day))
  return out
}

/** Inclusive yyyy-mm-dd bounds for the chosen period, or null for "no limit". */
export function periodRange(f: PrivateTaskFilters, now: Date = new Date()): { from: string; to: string } | null {
  if (f.period === 'all') return null
  const preset = f.period.split(':')[1]

  switch (preset) {
    case 'today': {
      const key = localDayKey(now)
      return { from: key, to: key }
    }
    case 'week': {
      const monday = startOfWeek(now)
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)
      return { from: localDayKey(monday), to: localDayKey(sunday) }
    }
    case 'month': {
      const first = new Date(now.getFullYear(), now.getMonth(), 1)
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      return { from: localDayKey(first), to: localDayKey(last) }
    }
    case 'custom': {
      if (!f.from && !f.to) return null
      // An open end stays open rather than collapsing to a single day.
      return { from: f.from || '0000-01-01', to: f.to || '9999-12-31' }
    }
    default:
      return null
  }
}

/** The fields filtering needs. Archived tasks carry archivedAt; board tasks don't. */
export type FilterableTask = Pick<PrivateTask, 'priority' | 'column' | 'dueDate' | 'createdAt'> & {
  archivedAt?: string | null
}

export function matchesFilters(
  task: FilterableTask,
  f: PrivateTaskFilters,
  now: Date = new Date()
): boolean {
  if (!f.includeArchived && task.archivedAt) return false
  if (f.priorities.length > 0 && !f.priorities.includes(task.priority)) return false
  if (f.columns.length > 0 && !f.columns.includes(task.column)) return false

  const range = periodRange(f, now)
  const basis = periodBasis(f.period)
  if (range && basis) {
    const key = taskDayKey(task, basis)
    // No date on the chosen field means the task can't fall inside a period —
    // it is reachable again by widening the period back to "Mind".
    if (!key) return false
    if (key < range.from || key > range.to) return false
  }
  return true
}

export const PRIORITY_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const

export const PRIORITY_LABELS: Record<string, string> = {
  CRITICAL: 'Kritikus',
  HIGH: 'Magas',
  MEDIUM: 'Közepes',
  LOW: 'Alacsony',
}

export const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: '#DC2626',
  HIGH: '#EA580C',
  MEDIUM: '#CA8A04',
  LOW: '#16A34A',
}

const PRIORITY_RANK: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }

export type SortableTask = FilterableTask & { id: string; position: number }

/**
 * Returns a new, ordered array — the input is left alone, since the board
 * renders several column slices from the same list.
 *
 * 'manual' is the drag order the board has always used. The date sorts put
 * tasks without that date last rather than first: an empty deadline is not
 * "due now", and letting those float to the top would bury the urgent ones.
 */
export function sortTasks<T extends SortableTask>(tasks: T[], sort: SortKey): T[] {
  const out = [...tasks]
  switch (sort) {
    case 'manual':
      return out.sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt))
    case 'dueDate':
      return out.sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return a.createdAt.localeCompare(b.createdAt)
        if (!a.dueDate) return 1
        if (!b.dueDate) return -1
        return a.dueDate.localeCompare(b.dueDate) || a.createdAt.localeCompare(b.createdAt)
      })
    case 'createdAt':
      // Newest first, which is what "by creation" means for a to-do list.
      return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    case 'priority':
      return out.sort((a, b) =>
        (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9)
        || a.createdAt.localeCompare(b.createdAt))
  }
}

export const COLUMN_SORT: Record<PrivateTaskColumnValue, number> = {
  TODO: 0, IN_PROGRESS: 1, BLOCKED: 2, DONE: 3,
}

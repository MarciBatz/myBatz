/**
 * Shared, client-safe definitions for the private task board.
 * The server-side access gate lives in lib/private-tasks-auth.ts so that
 * importing these constants from a client component doesn't pull in auth.
 */

/**
 * While the feature is being built it is limited to administrators. Flip this
 * to false to open it to everyone — it is the single switch guarding both the
 * API routes and the navigation entry.
 */
export const PRIVATE_TASKS_ADMIN_ONLY = true

export const PRIVATE_TASK_COLUMNS = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE'] as const
export type PrivateTaskColumnValue = (typeof PRIVATE_TASK_COLUMNS)[number]

export const COLUMN_LABELS: Record<PrivateTaskColumnValue, string> = {
  TODO: 'Teendő',
  IN_PROGRESS: 'Folyamatban',
  BLOCKED: 'Elakadt',
  DONE: 'Kész',
}

export const COLUMN_COLORS: Record<PrivateTaskColumnValue, string> = {
  TODO: '#64748B',
  IN_PROGRESS: '#6C5CE7',
  BLOCKED: '#DC2626',
  DONE: '#16A34A',
}

export function isPrivateTaskColumn(value: unknown): value is PrivateTaskColumnValue {
  return typeof value === 'string' && (PRIVATE_TASK_COLUMNS as readonly string[]).includes(value)
}

export interface LinkableTicket {
  id: string
  title: string
  status: string
  priority: string
}

export interface PrivateTask {
  id: string
  title: string
  description: string | null
  column: PrivateTaskColumnValue
  priority: string
  dueDate: string | null
  position: number
  ticketId: string | null
  ticket: { id: string; title: string; status: string } | null
  _count?: { comments: number }
  createdAt: string
  updatedAt: string
}

export interface PrivateTaskComment {
  id: string
  body: string
  createdAt: string
  updatedAt: string
}

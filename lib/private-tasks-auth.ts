import { NextRequest } from 'next/server'
import { requireSession, requireAdmin, type SessionUser } from './auth'
import { PRIVATE_TASKS_ADMIN_ONLY, canUsePrivateTasks } from './private-tasks'

/**
 * Gate for every private-task endpoint. Returns the session whose id must then
 * be used to scope the query — a private task is only ever readable by its
 * owner, with no administrator override, so callers must always filter on
 * `userId: session.id` rather than trusting an id from the request.
 */
export async function requirePrivateTaskAccess(request: NextRequest): Promise<SessionUser> {
  if (PRIVATE_TASKS_ADMIN_ONLY) return requireAdmin(request)

  const session = await requireSession(request)
  if (!canUsePrivateTasks(session.role)) throw new Error('FORBIDDEN')
  return session
}

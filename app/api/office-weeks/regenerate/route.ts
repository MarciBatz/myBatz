import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest, unauthorizedResponse, forbiddenResponse } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { rebuildFutureOfficeWeeks } from '@/lib/office-weeks'
import { writeAuditLog } from '@/lib/audit'

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return unauthorizedResponse()

  const canRegen = await hasPermission(session.id, session.role, 'canRegenerateOfficeSchedule')
  if (!canRegen) return forbiddenResponse()

  const { removed, created, from } = await rebuildFutureOfficeWeeks(52)

  await writeAuditLog(
    session.id,
    'office_schedule_regenerated',
    `${created} hét újraosztva ${from.toISOString().slice(0, 10)}-tól. A futó hét és a kézzel beállított hetek változatlanok.`,
    request
  )

  return NextResponse.json({ ok: true, created, removed })
}

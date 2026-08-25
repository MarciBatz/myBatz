import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest, unauthorizedResponse, forbiddenResponse } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { rebuildFutureOfficeWeeks } from '@/lib/office-weeks'
import { writeAuditLog } from '@/lib/audit'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(request)
  if (!session) return unauthorizedResponse()

  const { id } = await params

  // Users can always fetch their own settings; others need canManageEmailNotifications or ADMIN
  if (session.id !== id) {
    const canManage = await hasPermission(session.id, session.role, 'canManageEmailNotifications')
    if (session.role !== 'ADMIN' && !canManage) return forbiddenResponse()
  }
  const [prefs, perms] = await Promise.all([
    prisma.userPreferences.findUnique({ where: { userId: id } }),
    prisma.userPermissions.findUnique({ where: { userId: id } }),
  ])

  return NextResponse.json({ preferences: prefs, permissions: perms })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(request)
  if (!session) return unauthorizedResponse()

  const { id } = await params
  const body = await request.json()
  const { preferences, permissions } = body

  // Preferences: need canManageEmailNotifications or ADMIN
  if (preferences !== undefined) {
    const canManage = await hasPermission(session.id, session.role, 'canManageEmailNotifications')
    if (session.role !== 'ADMIN' && !canManage) return forbiddenResponse()

    const wasExcluded = (await prisma.userPreferences.findUnique({ where: { userId: id } }))?.excludeFromOfficeRotation ?? false
    const nowExcluded = preferences.excludeFromOfficeRotation ?? wasExcluded

    await prisma.userPreferences.upsert({
      where: { userId: id },
      update: preferences,
      create: { userId: id, ...preferences },
    })

    // Taking someone out of (or back into) the rotation reshuffles who is on
    // duty, so it only ever reaches weeks that haven't started and weren't set
    // by hand. It used to rebuild from the current Monday, which is why the
    // duty person for the week already under way could change without anyone
    // having touched the schedule.
    if (wasExcluded !== nowExcluded) {
      const { created, from } = await rebuildFutureOfficeWeeks(52)
      const target = await prisma.user.findUnique({ where: { id }, select: { name: true, email: true } })
      await writeAuditLog(
        session.id,
        'office_schedule_rebuilt',
        `${target?.name || target?.email || id} ${nowExcluded ? 'kikerült' : 'bekerült'} az irodai rotációba — ` +
        `${created} hét újraosztva ${from.toISOString().slice(0, 10)}-tól. A futó hét és a kézzel beállított hetek változatlanok.`,
        request
      )
    }
  }

  // Permissions: ADMIN only
  if (permissions !== undefined) {
    if (session.role !== 'ADMIN') return forbiddenResponse()

    await prisma.userPermissions.upsert({
      where: { userId: id },
      update: permissions,
      create: { userId: id, ...permissions },
    })
  }

  return NextResponse.json({ ok: true })
}

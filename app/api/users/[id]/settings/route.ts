import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest, unauthorizedResponse, forbiddenResponse } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { generateOfficeWeeks, getMonday } from '@/lib/office-weeks'

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

    // If exclusion changed, regenerate future office weeks
    if (wasExcluded !== nowExcluded) {
      const thisMonday = getMonday(new Date())
      await prisma.officeWeek.deleteMany({ where: { weekStart: { gte: thisMonday } } })
      await generateOfficeWeeks(52)
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

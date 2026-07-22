import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest, unauthorizedResponse, forbiddenResponse } from '@/lib/auth'
import { sendChangelogEmails } from '@/lib/email'

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return unauthorizedResponse()

  const entries = await prisma.changelogEntry.findMany({
    orderBy: { publishedAt: 'desc' },
  })
  return NextResponse.json({ entries })
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return unauthorizedResponse()
  if (session.role !== 'ADMIN') return forbiddenResponse()

  const { version, title, content, notifyUserIds } = await request.json()
  if (!version || !title || !content) {
    return NextResponse.json({ error: 'Hiányzó mezők' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { firstName: true, lastName: true, nickname: true, name: true },
  })
  const authorName = user?.nickname || user?.firstName || user?.name || 'Admin'

  const entry = await prisma.changelogEntry.create({
    data: { version, title, content, authorId: session.id, authorName },
  })

  // Notify the explicitly selected recipients. Unlike automatic notifications
  // this is a deliberate admin choice, so no per-user preference gates it.
  // Sent as one batch call rather than N concurrent requests — see
  // sendEmailBatch in lib/email.ts for why that matters here specifically.
  let notified = 0
  let failed = 0
  if (Array.isArray(notifyUserIds) && notifyUserIds.length > 0) {
    const recipients = await prisma.user.findMany({
      where: { id: { in: notifyUserIds }, status: 'ACTIVE' },
      select: { email: true, name: true, firstName: true, lastName: true, nickname: true },
    })
    const result = await sendChangelogEmails(recipients, { version, title, content }, authorName)
    notified = result.sent
    failed = result.failed
  }

  return NextResponse.json({ entry, notified, failed }, { status: 201 })
}

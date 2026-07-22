import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest, unauthorizedResponse, forbiddenResponse } from '@/lib/auth'
import { sendChangelogEmails } from '@/lib/email'

/**
 * Resends an existing entry's email without creating a new changelog row —
 * for filling in recipients a previous send missed (e.g. dropped by a rate
 * limit) without re-notifying everyone who already got it.
 *
 * 'exclude' mode exists so an admin who only knows who's ALREADY received the
 * email (visible in Resend) doesn't have to enumerate everyone else — the
 * complement is computed here against the live user table, not a list the
 * admin has to assemble by hand.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(request)
  if (!session) return unauthorizedResponse()
  if (session.role !== 'ADMIN') return forbiddenResponse()

  const { id } = await params
  const entry = await prisma.changelogEntry.findUnique({ where: { id } })
  if (!entry) return NextResponse.json({ error: 'A bejegyzés nem található' }, { status: 404 })

  const { mode, userIds } = await request.json()
  if (!['all', 'selected', 'exclude'].includes(mode)) {
    return NextResponse.json({ error: 'Ismeretlen küldési mód' }, { status: 400 })
  }
  const ids: string[] = Array.isArray(userIds) ? userIds : []
  if ((mode === 'selected' || mode === 'exclude') && ids.length === 0) {
    return NextResponse.json({ error: 'Válassz ki legalább egy felhasználót' }, { status: 400 })
  }

  const where =
    mode === 'all' ? { status: 'ACTIVE' as const }
    : mode === 'selected' ? { status: 'ACTIVE' as const, id: { in: ids } }
    : { status: 'ACTIVE' as const, id: { notIn: ids } }

  const recipients = await prisma.user.findMany({
    where,
    select: { email: true, name: true, firstName: true, lastName: true, nickname: true },
  })

  if (recipients.length === 0) {
    return NextResponse.json({ notified: 0, failed: 0 })
  }

  const author = await prisma.user.findUnique({
    where: { id: session.id },
    select: { firstName: true, lastName: true, nickname: true, name: true },
  })
  const senderName = author?.nickname || author?.firstName || author?.name || 'Admin'

  // Same { notified, failed } shape as POST /api/changelog's publish-time
  // send, so the frontend can read one response format for both.
  const result = await sendChangelogEmails(recipients, entry, senderName)
  return NextResponse.json({ notified: result.sent, failed: result.failed })
}

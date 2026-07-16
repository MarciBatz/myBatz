import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const user = await getSessionFromRequest(request)
  if (!user) return NextResponse.json({ ok: false }, { status: 401 })

  await prisma.user.update({
    where: { id: user.id },
    data: { lastSeenAt: new Date() },
  })

  return NextResponse.json({ ok: true })
}

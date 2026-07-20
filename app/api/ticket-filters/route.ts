import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession, unauthorizedResponse } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const user = await requireSession(request)
    const prefs = await prisma.userPreferences.findUnique({
      where: { userId: user.id },
      select: { ticketFilters: true },
    })
    let filters = null
    if (prefs?.ticketFilters) {
      try { filters = JSON.parse(prefs.ticketFilters) } catch { filters = null }
    }
    return NextResponse.json({ filters })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorizedResponse()
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireSession(request)
    const body = await request.json()
    const value = body?.filters ? JSON.stringify(body.filters) : null

    await prisma.userPreferences.upsert({
      where: { userId: user.id },
      update: { ticketFilters: value },
      create: { userId: user.id, ticketFilters: value },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorizedResponse()
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

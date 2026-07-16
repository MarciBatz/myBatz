import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession, unauthorizedResponse } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    await requireSession(request)
    const { searchParams } = request.nextUrl

    const userId = searchParams.get('userId') || undefined
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '50')

    const where: Record<string, unknown> = {}
    if (userId) where.userId = userId

    const [activities, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, firstName: true, nickname: true, email: true, avatarUrl: true } },
          ticket: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.activityLog.count({ where }),
    ])

    return NextResponse.json({ activities, total, page, pageSize })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorizedResponse()
    console.error('Activities GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

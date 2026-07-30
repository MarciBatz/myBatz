import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession, unauthorizedResponse } from '@/lib/auth'
import { COMPANY_WIDE } from '@/lib/departments'
import { getEligibleTicketUsers } from '@/lib/departments-access'

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request)
    const { searchParams } = request.nextUrl

    // Assignee and @mention pickers pass the ticket's target so the list only
    // offers people who can actually see that ticket. Without these params the
    // full directory is returned (used by admin screens and filter dropdowns).
    const forVisibility = searchParams.get('forVisibility')
    const forDepartmentId = searchParams.get('forDepartmentId')
    if (forVisibility === COMPANY_WIDE || forDepartmentId) {
      const eligible = await getEligibleTicketUsers({
        visibility: forVisibility === COMPANY_WIDE ? COMPANY_WIDE : 'DEPARTMENT',
        departmentId: forVisibility === COMPANY_WIDE ? null : forDepartmentId,
      })
      return NextResponse.json({ users: eligible })
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        nickname: true,
        role: true,
        status: true,
        avatarUrl: true,
        createdAt: true,
        lastSeenAt: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ users })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return unauthorizedResponse()
    }
    console.error('Users GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

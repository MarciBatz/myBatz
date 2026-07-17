import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from '@/lib/auth'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request)
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') return unauthorizedResponse()
    return forbiddenResponse()
  }

  const { id } = await params
  const { assignedUserId } = await request.json()

  const week = await prisma.officeWeek.update({
    where: { id },
    data: { assignedUserId, isManual: true },
    include: {
      assignedUser: {
        select: { id: true, name: true, firstName: true, lastName: true, nickname: true, email: true },
      },
    },
  })

  return NextResponse.json({ week })
}

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireSession, unauthorizedResponse, hashPassword, verifyPassword } from '@/lib/auth'

const schema = z.object({
  name: z.string().optional(),
  lastName: z.string().optional(),
  firstName: z.string().optional(),
  nickname: z.string().optional(),
  avatarUrl: z.string().url().optional().nullable(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).optional(),
})

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireSession(request)
    const body = await request.json()
    const data = schema.parse(body)

    const updateData: Record<string, unknown> = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.lastName !== undefined) updateData.lastName = data.lastName
    if (data.firstName !== undefined) updateData.firstName = data.firstName
    if (data.nickname !== undefined) updateData.nickname = data.nickname || null
    if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl

    if (data.newPassword) {
      if (!data.currentPassword) {
        return NextResponse.json({ error: 'Current password is required' }, { status: 400 })
      }
      const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
      if (!dbUser?.passwordHash) return NextResponse.json({ error: 'No password set' }, { status: 400 })

      const valid = await verifyPassword(data.currentPassword, dbUser.passwordHash)
      if (!valid) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })

      updateData.passwordHash = await hashPassword(data.newPassword)
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
      select: { id: true, email: true, name: true, lastName: true, firstName: true, nickname: true, role: true, status: true, avatarUrl: true },
    })

    return NextResponse.json({ user: updated })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorizedResponse()
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || "Validation error" }, { status: 400 })
    console.error('Profile PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

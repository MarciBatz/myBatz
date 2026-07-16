import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin, unauthorizedResponse, forbiddenResponse, getSessionFromRequest } from '@/lib/auth'
import { sendRoleChangedEmail } from '@/lib/email'
import { writeAuditLog } from '@/lib/audit'

const schema = z.object({
  status: z.enum(['ACTIVE', 'DISABLED', 'INVITED']).optional(),
  role: z.enum(['ADMIN', 'AGENT', 'READER']).optional(),
  name: z.string().optional(),
})

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request)
    const { id } = await params
    const body = await request.json()
    const data = schema.parse(body)

    const existing = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, firstName: true, nickname: true, role: true, status: true },
    })

    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, email: true, name: true, firstName: true, nickname: true, role: true, status: true, avatarUrl: true },
    })

    if (existing && data.role && data.role !== existing.role) {
      await sendRoleChangedEmail(user, existing.role, data.role).catch(() => {})
      await writeAuditLog(id, 'role_changed', `${existing.role} → ${data.role}`, request)
    }
    if (data.status && existing && data.status !== existing.status) {
      await writeAuditLog(id, 'status_changed', data.status, request)
    }

    return NextResponse.json({ user })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorizedResponse()
    if (error instanceof Error && error.message === 'FORBIDDEN') return forbiddenResponse()
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || "Validation error" }, { status: 400 })
    console.error('User PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(request)
    const { id } = await params

    if (admin.id === id) {
      return NextResponse.json({ error: 'Saját magadat nem törölheted' }, { status: 400 })
    }

    const target = await prisma.user.findUnique({ where: { id } })
    if (!target) return NextResponse.json({ error: 'Felhasználó nem található' }, { status: 404 })

    await prisma.user.delete({ where: { id } })
    await writeAuditLog(admin.id, 'user_deleted', `${target.email}`, request)

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorizedResponse()
    if (error instanceof Error && error.message === 'FORBIDDEN') return forbiddenResponse()
    console.error('User DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

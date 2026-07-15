import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { hashToken, hashPassword, createSession, getSessionCookieOptions } from '@/lib/auth'

const activateSchema = z.object({
  password: z.string().min(8),
})

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const tokenHash = hashToken(token)

  const invite = await prisma.invite.findFirst({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  })

  if (!invite) {
    return NextResponse.json({ valid: false }, { status: 400 })
  }
  return NextResponse.json({ valid: true, email: invite.email, name: invite.name })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const body = await request.json()
    const { password } = activateSchema.parse(body)

    const tokenHash = hashToken(token)
    const invite = await prisma.invite.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    })

    if (!invite) {
      return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 400 })
    }

    const passwordHash = await hashPassword(password)

    const user = await prisma.user.update({
      where: { email: invite.email },
      data: { passwordHash, status: 'ACTIVE' },
    })

    await prisma.invite.update({
      where: { id: invite.id },
      data: { usedAt: new Date() },
    })

    const sessionToken = await createSession(user.id)
    const response = NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    })
    response.cookies.set('session', sessionToken, getSessionCookieOptions())
    return response
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Validation error" }, { status: 400 })
    }
    console.error('Invite activation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

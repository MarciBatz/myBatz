import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin, unauthorizedResponse, forbiddenResponse, generateToken, hashToken } from '@/lib/auth'

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1, 'A név megadása kötelező'),
  role: z.enum(['ADMIN', 'AGENT', 'READER']).optional(),
})

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)
    const body = await request.json()
    const { email, name, role } = schema.parse(body)

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'Ezzel az email-címmel már létezik felhasználó' }, { status: 400 })
    }

    const token = generateToken()
    const tokenHash = hashToken(token)
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000) // 72 hours

    await prisma.$transaction([
      prisma.user.create({
        data: { email, name, role: role || 'AGENT', status: 'INVITED' },
      }),
      prisma.invite.create({
        data: { email, name, tokenHash, expiresAt },
      }),
    ])

    const appUrl = process.env.APP_URL || 'http://localhost:3001'
    const inviteLink = `${appUrl}/invite/${token}`

    return NextResponse.json({ success: true, inviteLink }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorizedResponse()
    if (error instanceof Error && error.message === 'FORBIDDEN') return forbiddenResponse()
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || 'Érvénytelen adat' }, { status: 400 })
    console.error('Invite POST error:', error)
    return NextResponse.json({ error: 'Szerverhiba' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, unauthorizedResponse, forbiddenResponse, generateToken, hashToken } from '@/lib/auth'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request)
    const { id } = await params

    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) return NextResponse.json({ error: 'Felhasználó nem található' }, { status: 404 })
    if (user.status !== 'INVITED') return NextResponse.json({ error: 'A felhasználó nem meghívott státuszban van' }, { status: 400 })

    const token = generateToken()
    const tokenHash = hashToken(token)
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000)

    await prisma.invite.create({ data: { email: user.email, name: user.name, tokenHash, expiresAt } })

    const appUrl = process.env.APP_URL || 'http://localhost:3001'
    const inviteLink = `${appUrl}/invite/${token}`

    return NextResponse.json({ success: true, inviteLink })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorizedResponse()
    if (error instanceof Error && error.message === 'FORBIDDEN') return forbiddenResponse()
    console.error('Resend invite error:', error)
    return NextResponse.json({ error: 'Szerverhiba' }, { status: 500 })
  }
}

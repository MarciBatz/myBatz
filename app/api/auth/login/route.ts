import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { verifyPassword, createSession, getSessionCookieOptions } from '@/lib/auth'
import { writeAuditLog } from '@/lib/audit'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = loginSchema.parse(body)

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || !user.passwordHash) {
      return NextResponse.json({ error: 'Hibás email cím vagy jelszó' }, { status: 401 })
    }

    if (user.status === 'DISABLED') {
      return NextResponse.json({ error: 'Ez a fiók le van tiltva' }, { status: 403 })
    }

    if (user.status === 'INVITED') {
      return NextResponse.json({ error: 'A fiók még nincs aktiválva. Ellenőrizd a meghívó emailt.' }, { status: 403 })
    }

    const valid = await verifyPassword(password, user.passwordHash)
    if (!valid) {
      return NextResponse.json({ error: 'Hibás email cím vagy jelszó' }, { status: 401 })
    }

    const token = await createSession(user.id)
    await writeAuditLog(user.id, 'login', user.email, request)

    const response = NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    })

    response.cookies.set('session', token, getSessionCookieOptions())
    return response
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Érvénytelen adatok' }, { status: 400 })
    }
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Szerverhiba történt' }, { status: 500 })
  }
}

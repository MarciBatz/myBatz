import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireSession, unauthorizedResponse } from '@/lib/auth'

const schema = z.object({
  title: z.string().min(1).max(255),
  body: z.string().min(1),
})

export async function GET(request: NextRequest) {
  try {
    await requireSession(request)
    const replies = await prisma.savedReply.findMany({
      include: { createdBy: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ replies })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorizedResponse()
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireSession(request)
    const body = await request.json()
    const data = schema.parse(body)
    const reply = await prisma.savedReply.create({
      data: { ...data, createdById: user.id },
      include: { createdBy: { select: { id: true, name: true, email: true } } },
    })
    return NextResponse.json({ reply }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorizedResponse()
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || "Validation error" }, { status: 400 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

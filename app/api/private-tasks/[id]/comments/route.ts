import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { unauthorizedResponse, forbiddenResponse } from '@/lib/auth'
import { requirePrivateTaskAccess } from '@/lib/private-tasks-auth'
import { writeAuditLog } from '@/lib/audit'

/** Resolves the task only if it belongs to the caller. */
async function ownedTask(taskId: string, userId: string) {
  return prisma.privateTask.findFirst({
    where: { id: taskId, userId },
    select: { id: true },
  })
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePrivateTaskAccess(request)
    const { id } = await params

    if (!(await ownedTask(id, session.id))) {
      return NextResponse.json({ error: 'A feladat nem található' }, { status: 404 })
    }

    const comments = await prisma.privateTaskComment.findMany({
      where: { privateTaskId: id },
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json({ comments })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorizedResponse()
    if (error instanceof Error && error.message === 'FORBIDDEN') return forbiddenResponse()
    console.error('Private task comments GET error:', error)
    return NextResponse.json({ error: 'Nem sikerült betölteni a bejegyzéseket' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePrivateTaskAccess(request)
    const { id } = await params

    if (!(await ownedTask(id, session.id))) {
      return NextResponse.json({ error: 'A feladat nem található' }, { status: 404 })
    }

    const { body } = await request.json()
    if (!body || !String(body).trim()) {
      return NextResponse.json({ error: 'A bejegyzés nem lehet üres' }, { status: 400 })
    }

    // Touching the parent in the same transaction keeps the timestamp shown on
    // the public ticket in step with the note that was just written.
    const [comment] = await prisma.$transaction([
      prisma.privateTaskComment.create({
        data: { privateTaskId: id, body: String(body).trim() },
      }),
      prisma.privateTask.update({ where: { id }, data: { updatedAt: new Date() } }),
    ])

    await writeAuditLog(session.id, 'private_task_commented', `Megjegyzés írva egy privát feladathoz (ID: ${id})`, request)

    return NextResponse.json({ comment }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorizedResponse()
    if (error instanceof Error && error.message === 'FORBIDDEN') return forbiddenResponse()
    console.error('Private task comments POST error:', error)
    return NextResponse.json({ error: 'Nem sikerült menteni a bejegyzést' }, { status: 500 })
  }
}

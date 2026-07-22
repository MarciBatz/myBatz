import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { unauthorizedResponse, forbiddenResponse } from '@/lib/auth'
import { requirePrivateTaskAccess } from '@/lib/private-tasks-auth'
import { isPrivateTaskColumn } from '@/lib/private-tasks'

async function assertLinkable(ticketId: string, userId: string): Promise<boolean> {
  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, assigneeId: userId, status: { not: 'CLOSED' } },
    select: { id: true },
  })
  return !!ticket
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePrivateTaskAccess(request)
    const { id } = await params

    // Scoped by userId, so someone else's id simply isn't found — the response
    // is identical whether the row is missing or owned by another user.
    const existing = await prisma.privateTask.findFirst({
      where: { id, userId: session.id },
      select: { id: true },
    })
    if (!existing) return NextResponse.json({ error: 'A feladat nem található' }, { status: 404 })

    const body = await request.json()
    const { title, description, column, priority, dueDate, ticketId } = body

    if (title !== undefined && !String(title).trim()) {
      return NextResponse.json({ error: 'A cím nem lehet üres' }, { status: 400 })
    }
    if (column !== undefined && !isPrivateTaskColumn(column)) {
      return NextResponse.json({ error: 'Ismeretlen oszlop' }, { status: 400 })
    }
    if (ticketId && !(await assertLinkable(ticketId, session.id))) {
      return NextResponse.json(
        { error: 'Csak olyan nyitott feladathoz kapcsolhatod, aminek te vagy a felelőse' },
        { status: 400 }
      )
    }

    const task = await prisma.privateTask.update({
      where: { id },
      data: {
        ...(title !== undefined && { title: String(title).trim() }),
        ...(description !== undefined && { description: description ? String(description) : null }),
        ...(column !== undefined && { column }),
        ...(priority !== undefined && { priority }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
        ...(ticketId !== undefined && { ticketId: ticketId || null }),
      },
      include: { ticket: { select: { id: true, title: true, status: true } } },
    })

    return NextResponse.json({ task })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorizedResponse()
    if (error instanceof Error && error.message === 'FORBIDDEN') return forbiddenResponse()
    console.error('Private task PUT error:', error)
    return NextResponse.json({ error: 'Nem sikerült menteni a feladatot' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePrivateTaskAccess(request)
    const { id } = await params

    const deleted = await prisma.privateTask.deleteMany({ where: { id, userId: session.id } })
    if (deleted.count === 0) {
      return NextResponse.json({ error: 'A feladat nem található' }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorizedResponse()
    if (error instanceof Error && error.message === 'FORBIDDEN') return forbiddenResponse()
    console.error('Private task DELETE error:', error)
    return NextResponse.json({ error: 'Nem sikerült törölni a feladatot' }, { status: 500 })
  }
}

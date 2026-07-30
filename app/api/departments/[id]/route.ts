import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from '@/lib/auth'
import { normalizeDepartmentName } from '@/lib/departments'
import { writeAuditLog } from '@/lib/audit'

const schema = z.object({
  name: z.string().min(1).max(80).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Érvénytelen szín').optional(),
})

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(request)
    const { id } = await params
    const data = schema.parse(await request.json())

    const existing = await prisma.department.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'A részleg nem található' }, { status: 404 })

    const updates: { name?: string; nameNormalized?: string; color?: string } = {}

    if (data.name !== undefined) {
      const trimmed = data.name.trim()
      if (!trimmed) return NextResponse.json({ error: 'A részleg neve nem lehet üres' }, { status: 400 })
      const nameNormalized = normalizeDepartmentName(trimmed)
      if (nameNormalized !== existing.nameNormalized) {
        const clash = await prisma.department.findUnique({ where: { nameNormalized }, select: { id: true, name: true } })
        if (clash && clash.id !== id) {
          return NextResponse.json(
            { error: `Már létezik részleg ezzel a névvel: „${clash.name}”` },
            { status: 400 }
          )
        }
      }
      updates.name = trimmed
      updates.nameNormalized = nameNormalized
    }
    if (data.color !== undefined) updates.color = data.color

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ department: existing })
    }

    const department = await prisma.department.update({ where: { id }, data: updates })

    if (updates.name && updates.name !== existing.name) {
      await writeAuditLog(admin.id, 'department_renamed', `Részleg átnevezve: „${existing.name}” → „${updates.name}”`, request)
    }
    if (updates.color && updates.color !== existing.color) {
      await writeAuditLog(admin.id, 'department_color_changed', `Részleg színe módosítva: „${department.name}” (${existing.color} → ${updates.color})`, request)
    }

    return NextResponse.json({ department })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorizedResponse()
    if (error instanceof Error && error.message === 'FORBIDDEN') return forbiddenResponse()
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || 'Érvénytelen adat' }, { status: 400 })
    }
    console.error('Department PATCH error:', error)
    return NextResponse.json({ error: 'Nem sikerült módosítani a részleget' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(request)
    const { id } = await params

    // Counted and deleted in one transaction so a ticket or membership created
    // concurrently can't slip in between the check and the delete.
    const result = await prisma.$transaction(async tx => {
      const existing = await tx.department.findUnique({
        where: { id },
        select: { id: true, name: true, _count: { select: { members: true, tickets: true } } },
      })
      if (!existing) return { status: 404 as const, error: 'A részleg nem található' }

      const { members, tickets } = existing._count
      if (members > 0 || tickets > 0) {
        const parts: string[] = []
        if (tickets > 0) parts.push(`${tickets} feladat`)
        if (members > 0) parts.push(`${members} felhasználó`)
        return {
          status: 400 as const,
          error: `A(z) „${existing.name}” részleg nem törölhető, mert ${parts.join(' és ')} tartozik hozzá. Előbb helyezd át vagy zárd le a feladatokat, és távolítsd el a felhasználókat a részlegből.`,
        }
      }

      await tx.department.delete({ where: { id } })
      return { status: 200 as const, name: existing.name }
    })

    if (result.status !== 200) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    await writeAuditLog(admin.id, 'department_deleted', `Részleg törölve: „${result.name}”`, request)
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorizedResponse()
    if (error instanceof Error && error.message === 'FORBIDDEN') return forbiddenResponse()
    console.error('Department DELETE error:', error)
    return NextResponse.json({ error: 'Nem sikerült törölni a részleget' }, { status: 500 })
  }
}

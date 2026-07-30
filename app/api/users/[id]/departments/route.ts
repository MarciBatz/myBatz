import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from '@/lib/auth'
import { writeAuditLog } from '@/lib/audit'
import { sendDepartmentAssignmentEmail } from '@/lib/email'
import { fullDisplayName } from '@/lib/utils'

const schema = z.object({ departmentIds: z.array(z.string()) })

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request)
    const { id } = await params
    const rows = await prisma.userDepartment.findMany({
      where: { userId: id },
      select: { departmentId: true },
    })
    return NextResponse.json({ departmentIds: rows.map(r => r.departmentId) })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorizedResponse()
    if (error instanceof Error && error.message === 'FORBIDDEN') return forbiddenResponse()
    console.error('User departments GET error:', error)
    return NextResponse.json({ error: 'Nem sikerült betölteni a részlegeket' }, { status: 500 })
  }
}

/**
 * Replaces a user's department memberships.
 *
 * Removals are blocked while the user still has an open ticket assigned to them
 * in that department — losing access would orphan work in progress. The check
 * and the writes happen in one transaction so a ticket assigned concurrently
 * (e.g. from a second browser tab) can't slip past it.
 *
 * Newly added departments trigger exactly one summary email, sent after the
 * transaction commits: a mail failure must not roll back a successful
 * assignment. Removals never trigger mail.
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(request)
    const { id } = await params
    const { departmentIds } = schema.parse(await request.json())
    const requested = Array.from(new Set(departmentIds))

    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, firstName: true, lastName: true, nickname: true, role: true },
    })
    if (!targetUser) return NextResponse.json({ error: 'A felhasználó nem található' }, { status: 404 })

    const outcome = await prisma.$transaction(async tx => {
      const validDepartments = await tx.department.findMany({
        where: { id: { in: requested } },
        select: { id: true, name: true, color: true },
      })
      if (validDepartments.length !== requested.length) {
        return { status: 400 as const, error: 'Egy vagy több megadott részleg nem létezik.' }
      }

      const current = await tx.userDepartment.findMany({
        where: { userId: id },
        select: { departmentId: true },
      })
      const currentIds = new Set(current.map(r => r.departmentId))
      const requestedIds = new Set(requested)

      const toAdd = requested.filter(d => !currentIds.has(d))
      const toRemove = [...currentIds].filter(d => !requestedIds.has(d))

      // Guard each removal: any open ticket still assigned to this user in that
      // department blocks it, and we report them so the admin can act.
      if (toRemove.length > 0) {
        const blocking = await tx.ticket.findMany({
          where: {
            assigneeId: id,
            status: { not: 'CLOSED' },
            visibility: 'DEPARTMENT',
            departmentId: { in: toRemove },
          },
          select: { id: true, title: true, departmentId: true },
          orderBy: { updatedAt: 'desc' },
        })
        if (blocking.length > 0) {
          const names = new Map(
            (await tx.department.findMany({
              where: { id: { in: toRemove } },
              select: { id: true, name: true },
            })).map(d => [d.id, d.name])
          )
          return {
            status: 409 as const,
            error:
              'A felhasználó nem távolítható el a részlegből, mert még van hozzá rendelt, nem lezárt feladata. ' +
              'Előbb zárd le ezeket, vagy add át őket egy másik, jogosult felhasználónak.',
            blockingTickets: blocking.map(t => ({
              id: t.id,
              title: t.title,
              departmentName: t.departmentId ? names.get(t.departmentId) ?? '—' : '—',
            })),
          }
        }
      }

      if (toRemove.length > 0) {
        await tx.userDepartment.deleteMany({ where: { userId: id, departmentId: { in: toRemove } } })
      }
      if (toAdd.length > 0) {
        await tx.userDepartment.createMany({
          data: toAdd.map(departmentId => ({ userId: id, departmentId })),
          skipDuplicates: true,
        })
      }

      // Drop no-longer-accessible department ids from the user's saved filter so
      // a stale id can't linger in their persisted scope.
      if (toRemove.length > 0) {
        const prefs = await tx.userPreferences.findUnique({
          where: { userId: id },
          select: { ticketFilters: true },
        })
        if (prefs?.ticketFilters) {
          try {
            const parsed = JSON.parse(prefs.ticketFilters)
            const strip = (key: 'departmentIds' | 'knownDepartmentIds') => {
              if (!Array.isArray(parsed?.[key])) return false
              const cleaned = parsed[key].filter(
                (d: unknown) => typeof d === 'string' && !toRemove.includes(d)
              )
              if (cleaned.length === parsed[key].length) return false
              parsed[key] = cleaned
              return true
            }
            // knownDepartmentIds is cleaned too: if access is granted again later
            // the department should count as new and reappear in the selection.
            const changed = [strip('departmentIds'), strip('knownDepartmentIds')].some(Boolean)
            if (changed) {
              await tx.userPreferences.update({
                where: { userId: id },
                data: { ticketFilters: JSON.stringify(parsed) },
              })
            }
          } catch {
            // Malformed saved filter: leave it alone, the reader tolerates it.
          }
        }
      }

      const nameById = new Map(validDepartments.map(d => [d.id, d]))
      return {
        status: 200 as const,
        added: toAdd.map(d => nameById.get(d)!).filter(Boolean),
        removed: toRemove,
      }
    })

    if (outcome.status !== 200) {
      return NextResponse.json(
        { error: outcome.error, blockingTickets: 'blockingTickets' in outcome ? outcome.blockingTickets : undefined },
        { status: outcome.status }
      )
    }

    const targetName = fullDisplayName(targetUser) || targetUser.email

    // Audit both directions before the email, so the record of the change exists
    // regardless of what happens with delivery.
    if (outcome.added.length > 0) {
      await writeAuditLog(
        admin.id,
        'user_departments_added',
        `${targetName} részleghez rendelve: ${outcome.added.map(d => `„${d.name}”`).join(', ')}`,
        request
      )
    }
    if (outcome.removed.length > 0) {
      const removedNames = await prisma.department.findMany({
        where: { id: { in: outcome.removed } },
        select: { name: true },
      })
      await writeAuditLog(
        admin.id,
        'user_departments_removed',
        `${targetName} eltávolítva a részleg(ek)ből: ${removedNames.map(d => `„${d.name}”`).join(', ')}`,
        request
      )
    }

    // Only genuinely new memberships get a mail, and only after we've confirmed
    // they persisted. Re-saving an unchanged set sends nothing.
    let emailSent: boolean | null = null
    if (outcome.added.length > 0) {
      const persisted = await prisma.userDepartment.findMany({
        where: { userId: id, departmentId: { in: outcome.added.map(d => d.id) } },
        select: { departmentId: true },
      })
      const persistedIds = new Set(persisted.map(p => p.departmentId))
      const confirmed = outcome.added.filter(d => persistedIds.has(d.id))

      if (confirmed.length > 0) {
        // READERs can't create anything, so the email shouldn't promise it.
        const canCreateHere = targetUser.role !== 'READER'
        try {
          await sendDepartmentAssignmentEmail(targetUser, confirmed, canCreateHere)
          emailSent = true
          await writeAuditLog(
            admin.id,
            'department_assignment_email_sent',
            `Részleg-hozzárendelési értesítő elküldve: ${targetName} (${confirmed.length} részleg)`,
            request
          )
        } catch (mailError) {
          // The assignment stands; only the notification failed.
          emailSent = false
          console.error('Department assignment email error:', mailError)
          await writeAuditLog(
            admin.id,
            'department_assignment_email_failed',
            `Részleg-hozzárendelési értesítő nem küldhető el: ${targetName}`,
            request
          )
        }
      }
    }

    return NextResponse.json({
      ok: true,
      added: outcome.added.length,
      removed: outcome.removed.length,
      emailSent,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorizedResponse()
    if (error instanceof Error && error.message === 'FORBIDDEN') return forbiddenResponse()
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || 'Érvénytelen adat' }, { status: 400 })
    }
    console.error('User departments PUT error:', error)
    return NextResponse.json({ error: 'Nem sikerült menteni a részlegeket' }, { status: 500 })
  }
}

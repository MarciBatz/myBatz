import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireReadWrite, unauthorizedResponse } from '@/lib/auth'
import { sendNewCommentEmail } from '@/lib/email'
import { displayName } from '@/lib/utils'

const attachmentSchema = z.object({
  fileUrl: z.string(),
  fileName: z.string(),
  fileSize: z.number().optional(),
  mimeType: z.string().optional(),
})

const schema = z.object({
  body: z.string().min(1),
  isInternal: z.boolean().optional(),
  attachments: z.array(attachmentSchema).optional(),
})

function extractMentions(body: string): string[] {
  const matches = body.match(/@\[([^\]]+)\]\(([^)]+)\)/g) || []
  return matches.map(m => {
    const idMatch = m.match(/\(([^)]+)\)/)
    return idMatch ? idMatch[1] : ''
  }).filter(Boolean)
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireReadWrite(request)
    const { id } = await params
    const body = await request.json()
    const data = schema.parse(body)

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, email: true, name: true, nickname: true } },
        assignee: { select: { id: true, email: true, name: true, nickname: true } },
      },
    })
    if (!ticket) {
      return NextResponse.json({ error: 'A ticket nem található' }, { status: 404 })
    }

    const comment = await prisma.comment.create({
      data: {
        ticketId: id,
        userId: user.id,
        body: data.body,
        isInternal: data.isInternal || false,
        ...(data.attachments && data.attachments.length > 0 && {
          attachments: {
            create: data.attachments.map(a => ({
              fileUrl: a.fileUrl,
              fileName: a.fileName,
              fileSize: a.fileSize || 0,
              mimeType: a.mimeType,
              uploadedById: user.id,
              ticketId: id,
            })),
          },
        }),
      },
      include: {
        user: { select: { id: true, name: true, nickname: true, email: true, avatarUrl: true } },
        attachments: true,
      },
    })

    await prisma.activityLog.create({
      data: {
        ticketId: id,
        userId: user.id,
        action: data.isInternal ? 'internal_note_added' : 'comment_added',
        newValue: data.body.slice(0, 100),
      },
    })

    const authorName = displayName(user)
    const appUrl = process.env.APP_URL || 'http://localhost:3001'
    const ticketLink = `/tickets/${id}`

    if (!data.isInternal) {
      // Collect unique users to notify: assignee + creator, excluding comment author
      const toNotify = new Map<string, { id: string; email: string; name: string | null; nickname: string | null }>()
      if (ticket.assignee && ticket.assignee.id !== user.id) toNotify.set(ticket.assignee.id, ticket.assignee)
      if (ticket.createdBy && ticket.createdBy.id !== user.id) toNotify.set(ticket.createdBy.id, ticket.createdBy)

      const notifyList = Array.from(toNotify.values())
      if (notifyList.length > 0) {
        await sendNewCommentEmail(notifyList, { id, title: ticket.title }, { body: data.body, authorName })
        await prisma.notificationLog.createMany({
          data: notifyList.map(u => ({
            userId: u.id,
            ticketId: id,
            type: 'comment',
            message: `${authorName} hozzászólt: "${ticket.title}"`,
            link: ticketLink,
          })),
        })
      }

      // Handle @mentions
      const mentionedIds = extractMentions(data.body)
      if (mentionedIds.length > 0) {
        const mentionedUsers = await prisma.user.findMany({
          where: { id: { in: mentionedIds }, NOT: { id: user.id } },
          select: { id: true, email: true, name: true, nickname: true },
        })
        // Send email + in-app notification to mentioned users not already notified
        const alreadyNotified = new Set(notifyList.map(u => u.id))
        const newMentions = mentionedUsers.filter(u => !alreadyNotified.has(u.id))
        if (newMentions.length > 0) {
          await sendNewCommentEmail(newMentions, { id, title: ticket.title }, { body: data.body, authorName })
        }
        await prisma.notificationLog.createMany({
          data: mentionedUsers.map(u => ({
            userId: u.id,
            ticketId: id,
            type: 'mention',
            message: `${authorName} megemlített: "${ticket.title}"`,
            link: ticketLink,
          })),
        })
      }
    }

    return NextResponse.json({ comment }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorizedResponse()
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || 'Érvénytelen adat' }, { status: 400 })
    }
    console.error('Comment POST error:', error)
    return NextResponse.json({ error: 'Szerverhiba történt' }, { status: 500 })
  }
}

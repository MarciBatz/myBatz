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

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireReadWrite(request)
    const { id } = await params
    const body = await request.json()
    const data = schema.parse(body)

    const ticket = await prisma.ticket.findUnique({ where: { id } })
    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
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

    // Notify assignee if there is one and it's not an internal note
    if (!data.isInternal && ticket.assigneeId && ticket.assigneeId !== user.id) {
      const assignee = await prisma.user.findUnique({
        where: { id: ticket.assigneeId },
        select: { email: true, name: true, nickname: true },
      })
      if (assignee) {
        await sendNewCommentEmail([assignee], { id, title: ticket.title }, {
          body: data.body,
          authorName: displayName(user),
        })
      }
    }

    return NextResponse.json({ comment }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return unauthorizedResponse()
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Validation error" }, { status: 400 })
    }
    console.error('Comment POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

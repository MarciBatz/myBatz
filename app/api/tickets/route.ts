import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireSession, requireReadWrite, unauthorizedResponse } from '@/lib/auth'
import { sendNewTicketEmail } from '@/lib/email'
import { displayName } from '@/lib/utils'

const attachmentSchema = z.object({
  fileUrl: z.string(),
  fileName: z.string(),
  fileSize: z.number().optional(),
  mimeType: z.string().optional(),
})

const createSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().min(1),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  categoryId: z.string().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  attachments: z.array(attachmentSchema).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const user = await requireSession(request)
    const { searchParams } = request.nextUrl

    const status = searchParams.get('status') || undefined
    const priority = searchParams.get('priority') || undefined
    const categoryId = searchParams.get('categoryId') || undefined
    const assigneeId = searchParams.get('assigneeId') || undefined
    const search = searchParams.get('search') || undefined
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (priority) where.priority = priority
    if (categoryId) where.categoryId = categoryId
    if (assigneeId) where.assigneeId = assigneeId
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        include: {
          category: true,
          assignee: { select: { id: true, name: true, nickname: true, email: true, avatarUrl: true } },
          createdBy: { select: { id: true, name: true, nickname: true, email: true, avatarUrl: true } },
          _count: { select: { comments: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.ticket.count({ where }),
    ])

    return NextResponse.json({ tickets, total, page, pageSize })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return unauthorizedResponse()
    }
    console.error('Tickets GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireReadWrite(request)
    const body = await request.json()
    const data = createSchema.parse(body)

    const ticket = await prisma.ticket.create({
      data: {
        title: data.title,
        description: data.description,
        priority: data.priority || 'MEDIUM',
        categoryId: data.categoryId || null,
        assigneeId: data.assigneeId || null,
        createdById: user.id,
        ...(data.attachments && data.attachments.length > 0 && {
          attachments: {
            create: data.attachments.map(a => ({
              fileUrl: a.fileUrl,
              fileName: a.fileName,
              fileSize: a.fileSize || 0,
              mimeType: a.mimeType,
              uploadedById: user.id,
            })),
          },
        }),
      },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        category: true,
      },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        ticketId: ticket.id,
        userId: user.id,
        action: 'created',
        newValue: 'Ticket created',
      },
    })

    // Send notification to all ADMIN and AGENT users
    const notifyUsers = await prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'AGENT'] }, status: 'ACTIVE' },
      select: { id: true, email: true, name: true, nickname: true, firstName: true },
    })
    const creatorName = displayName(user)
    await sendNewTicketEmail(notifyUsers, {
      id: ticket.id,
      title: ticket.title,
      description: ticket.description,
      priority: ticket.priority,
    }, creatorName)

    return NextResponse.json({ ticket }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return unauthorizedResponse()
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Validation error" }, { status: 400 })
    }
    console.error('Tickets POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

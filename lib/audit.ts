import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

export async function writeAuditLog(
  userId: string | null,
  action: string,
  detail?: string,
  request?: NextRequest
) {
  const ip = request
    ? (request.headers.get('x-forwarded-for')?.split(',')[0] ?? request.headers.get('x-real-ip') ?? null)
    : null

  await prisma.auditLog.create({
    data: { userId, action, detail: detail ?? null, ip },
  }).catch(() => {})
}

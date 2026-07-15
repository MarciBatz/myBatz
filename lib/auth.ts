import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import { prisma } from './prisma'

const AUTH_SECRET = process.env.AUTH_SECRET || 'fallback-secret-change-in-production'
const COOKIE_NAME = 'session'
const TOKEN_EXPIRY = '7d'

export interface SessionUser {
  id: string
  email: string
  name: string | null
  lastName: string | null
  firstName: string | null
  nickname: string | null
  role: string
  status: string
  avatarUrl: string | null
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export function createSessionToken(userId: string): string {
  return jwt.sign({ userId }, AUTH_SECRET, { expiresIn: TOKEN_EXPIRY })
}

export async function createSession(userId: string): Promise<string> {
  const token = createSessionToken(userId)
  return token
}

export async function getSessionFromRequest(request: NextRequest): Promise<SessionUser | null> {
  const token = request.cookies.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifySessionToken(token)
}

export async function getSession(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    if (!token) return null
    return verifySessionToken(token)
  } catch {
    return null
  }
}

async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const payload = jwt.verify(token, AUTH_SECRET) as { userId: string }
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, name: true, lastName: true, firstName: true, nickname: true, role: true, status: true, avatarUrl: true },
    })
    if (!user || user.status === 'DISABLED') return null
    return user
  } catch {
    return null
  }
}

export async function requireSession(request: NextRequest): Promise<SessionUser> {
  const user = await getSessionFromRequest(request)
  if (!user) {
    throw new Error('UNAUTHORIZED')
  }
  return user
}

export async function requireAdmin(request: NextRequest): Promise<SessionUser> {
  const user = await requireSession(request)
  if (user.role !== 'ADMIN') {
    throw new Error('FORBIDDEN')
  }
  return user
}

export async function requireReadWrite(request: NextRequest): Promise<SessionUser> {
  const user = await requireSession(request)
  if (user.role === 'READER') {
    throw new Error('FORBIDDEN')
  }
  return user
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  }
}

export function unauthorizedResponse(message = 'Unauthorized') {
  return new Response(JSON.stringify({ error: message }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  })
}

export function forbiddenResponse(message = 'Forbidden') {
  return new Response(JSON.stringify({ error: message }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  })
}

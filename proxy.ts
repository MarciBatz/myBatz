import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'

const AUTH_SECRET = process.env.AUTH_SECRET || 'fallback-secret-change-in-production'

function getTokenFromRequest(request: NextRequest): string | null {
  return request.cookies.get('session')?.value ?? null
}

function isValidToken(token: string): boolean {
  try {
    jwt.verify(token, AUTH_SECRET)
    return true
  } catch {
    return false
  }
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public auth routes - always allow
  const publicAuthPaths = [
    '/api/auth/login',
    '/api/auth/logout',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
    '/api/invite',
  ]

  const isPublicApiRoute = publicAuthPaths.some((p) => pathname.startsWith(p))
  const isApiRoute = pathname.startsWith('/api/')
  const isDashboardRoute = pathname.startsWith('/dashboard') || pathname === '/'
  const isLoginPage = pathname === '/login'
  const isInvitePage = pathname.startsWith('/invite/')
  const isForgotPage = pathname === '/forgot-password'
  const isResetPage = pathname.startsWith('/reset-password/')

  // Allow public pages
  if (isLoginPage || isInvitePage || isForgotPage || isResetPage) {
    return NextResponse.next()
  }

  // Allow public API routes
  if (isPublicApiRoute) {
    return NextResponse.next()
  }

  const token = getTokenFromRequest(request)
  const authenticated = token ? isValidToken(token) : false

  // Protect API routes
  if (isApiRoute && !authenticated) {
    return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Protect dashboard routes
  if (isDashboardRoute && !authenticated) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|uploads).*)'],
}

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const val = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || ''
  return NextResponse.json({
    length: val.length,
    first100: val.slice(0, 100),
    charCodes: Array.from(val.slice(0, 10)).map(c => c.charCodeAt(0)),
  })
}

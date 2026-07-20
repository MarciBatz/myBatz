import { NextRequest, NextResponse } from 'next/server'
import { requireSession, unauthorizedResponse } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    await requireSession(request)

    const url = request.nextUrl.searchParams.get('url')
    if (!url) return NextResponse.json({ error: 'Hiányzó url paraméter' }, { status: 400 })

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({ error: 'A fájltárolás nincs beállítva a szerveren' }, { status: 500 })
    }

    const { get } = await import('@vercel/blob')
    const result = await get(url, { access: 'private' })
    if (!result || !result.stream) {
      return NextResponse.json({ error: 'A fájl nem található' }, { status: 404 })
    }

    const contentType = result.headers.get('content-type') || result.blob.contentType || 'application/octet-stream'
    return new Response(result.stream, {
      headers: {
        'Content-Type': contentType,
        // Private cache only; never store on shared/CDN caches
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorizedResponse()
    console.error('File proxy error:', error)
    return NextResponse.json({ error: 'A fájl betöltése nem sikerült' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { requireSession, unauthorizedResponse } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

export async function POST(request: NextRequest) {
  try {
    await requireSession(request)

    const formData = await request.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: 'Nincs fájl megadva' }, { status: 400 })

    const MAX_SIZE = 50 * 1024 * 1024 // 50 MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'A fájl mérete nem lehet nagyobb 50 MB-nál' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const uploadDir = path.join(process.cwd(), 'public', 'uploads')
    await mkdir(uploadDir, { recursive: true })

    const ext = path.extname(file.name)
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`
    const filePath = path.join(uploadDir, fileName)
    await writeFile(filePath, buffer)

    return NextResponse.json({ url: `/uploads/${fileName}`, fileName: file.name, size: file.size })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorizedResponse()
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

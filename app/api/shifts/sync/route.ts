import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession, unauthorizedResponse, forbiddenResponse } from '@/lib/auth'
import { fetchSheetRows } from '@/lib/sheets'

export async function POST(request: NextRequest) {
  try {
    await requireSession(request)

    const tab = '2026'
    const rows = await fetchSheetRows(tab)

    let upserted = 0
    for (const row of rows) {
      await prisma.shiftDay.upsert({
        where: { rowIndex_sheetTab: { rowIndex: row.rowIndex, sheetTab: tab } },
        update: {
          date: new Date(row.date),
          timeStart: row.timeStart,
          timeEnd: row.timeEnd,
          location: row.location,
          shopName: row.shopName,
          address: row.address,
          contactEmail: row.contactEmail,
          contactPhone: row.contactPhone,
          adMode: row.adMode,
          assignedTo: row.assignedTo,
          forSelf: row.forSelf,
          notes: row.notes,
          shopCode: row.shopCode,
          strikethrough: row.strikethrough,
          bgColor: row.bgColor,
          syncedAt: new Date(),
        },
        create: {
          rowIndex: row.rowIndex,
          sheetTab: tab,
          date: new Date(row.date),
          timeStart: row.timeStart,
          timeEnd: row.timeEnd,
          location: row.location,
          shopName: row.shopName,
          address: row.address,
          contactEmail: row.contactEmail,
          contactPhone: row.contactPhone,
          adMode: row.adMode,
          assignedTo: row.assignedTo,
          forSelf: row.forSelf,
          notes: row.notes,
          shopCode: row.shopCode,
          strikethrough: row.strikethrough,
          bgColor: row.bgColor,
        },
      })
      upserted++
    }

    // Delete rows no longer present in the sheet
    const currentRowIndexes = rows.map(r => r.rowIndex)
    const deleted = await prisma.shiftDay.deleteMany({
      where: { sheetTab: tab, rowIndex: { notIn: currentRowIndexes } },
    })

    return NextResponse.json({ ok: true, upserted, deleted: deleted.count, total: rows.length })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorizedResponse()
    if (error instanceof Error && error.message === 'FORBIDDEN') return forbiddenResponse()
    console.error('Sync error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

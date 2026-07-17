import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchSheetRows } from '@/lib/sheets'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const tab = '2026'
    const rows = await fetchSheetRows(tab)

    let upserted = 0
    for (const row of rows) {
      await prisma.shiftDay.upsert({
        where: { rowIndex_sheetTab: { rowIndex: row.rowIndex, sheetTab: tab } },
        update: {
          date: new Date(row.date!),
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
          syncedAt: new Date(),
        },
        create: {
          rowIndex: row.rowIndex,
          sheetTab: tab,
          date: new Date(row.date!),
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
        },
      })
      upserted++
    }

    return NextResponse.json({ ok: true, upserted, total: rows.length })
  } catch (error) {
    console.error('Sync shifts error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

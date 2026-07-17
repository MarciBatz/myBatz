// Google Sheets API helper

interface SheetRow {
  rowIndex: number
  date: string
  timeStart: string | null
  timeEnd: string | null
  location: string | null
  shopName: string | null
  address: string | null
  contactEmail: string | null
  contactPhone: string | null
  adMode: string | null
  assignedTo: string | null
  forSelf: boolean
  notes: string | null
  shopCode: string | null
  strikethrough: boolean
  bgColor: string | null
}

function parseTime(val: string): { start: string | null; end: string | null } {
  if (!val) return { start: null, end: null }
  const match = val.match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/)
  if (match) return { start: match[1], end: match[2] }
  return { start: val.trim() || null, end: null }
}

function parseDate(val: string): string | null {
  if (!val) return null
  // Handle "2026.03.24." or "2026.3.24." format (1 or 2 digit month/day)
  const dotMatch = val.match(/(\d{4})\.(\d{1,2})\.(\d{1,2})/)
  if (dotMatch) {
    const y = dotMatch[1]
    const m = dotMatch[2].padStart(2, '0')
    const d = dotMatch[3].padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  // Handle "YYYY-MM-DD" format
  const isoMatch = val.match(/(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (isoMatch) {
    const y = isoMatch[1]
    const m = isoMatch[2].padStart(2, '0')
    const d = isoMatch[3].padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  // Handle Google Sheets serial date number (days since 1899-12-30)
  const serial = parseFloat(val)
  if (!isNaN(serial) && serial > 40000 && serial < 60000) {
    const d = new Date((serial - 25569) * 86400 * 1000)
    const y = d.getUTCFullYear()
    const mo = String(d.getUTCMonth() + 1).padStart(2, '0')
    const day = String(d.getUTCDate()).padStart(2, '0')
    return `${y}-${mo}-${day}`
  }
  return null
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('')
}

export async function fetchSheetRows(tab: string = '2026'): Promise<SheetRow[]> {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON

  if (!spreadsheetId || !serviceAccountJson) {
    throw new Error('GOOGLE_SHEET_ID vagy GOOGLE_SERVICE_ACCOUNT_JSON nincs beállítva')
  }

  let saJson = serviceAccountJson.trim()
  if ((saJson.startsWith('"') && saJson.endsWith('"')) || (saJson.startsWith("'") && saJson.endsWith("'"))) {
    saJson = saJson.slice(1, -1)
  }
  let sa
  try {
    sa = JSON.parse(saJson)
  } catch {
    try {
      sa = JSON.parse(saJson.replace(/\n/g, '\\n'))
    } catch (e) {
      console.error('GOOGLE_SERVICE_ACCOUNT_JSON parse failed. First 200 chars:', saJson.slice(0, 200))
      throw e
    }
  }

  const token = await getAccessToken(sa)

  // Fetch values
  const range = encodeURIComponent(`${tab}!A2:S2000`)
  const valuesUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`
  const valRes = await fetch(valuesUrl, { headers: { Authorization: `Bearer ${token}` } })
  if (!valRes.ok) throw new Error(`Sheets API hiba: ${await valRes.text()}`)
  const valData = await valRes.json()
  const rows: string[][] = valData.values || []

  // Fetch formatting (strikethrough + background color)
  const fmtRange = encodeURIComponent(`${tab}!A2:A2000`)
  const fmtUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?includeGridData=true&ranges=${fmtRange}&fields=sheets.data.rowData.values.userEnteredFormat`
  const fmtRes = await fetch(fmtUrl, { headers: { Authorization: `Bearer ${token}` } })
  type CellFormat = { textFormat?: { strikethrough?: boolean }; backgroundColor?: { red?: number; green?: number; blue?: number } }
  type RowData = { values?: CellFormat[] }
  const fmtData = fmtRes.ok ? await fmtRes.json() : null
  const fmtRows: RowData[] = fmtData?.sheets?.[0]?.data?.[0]?.rowData ?? []

  return rows
    .map((row, i) => {
      const dateStr = parseDate(row[0] || '')
      if (!dateStr) return null as unknown as SheetRow

      const { start, end } = parseTime(row[1] || '')

      const cellFmt: CellFormat = fmtRows[i]?.values?.[0] ?? {}
      const strikethrough = cellFmt.textFormat?.strikethrough ?? false
      const bg = cellFmt.backgroundColor
      // Google Sheets default white background is {red:1, green:1, blue:1} — treat as no color
      const isDefault = !bg || (bg.red === 1 && bg.green === 1 && bg.blue === 1) || (bg.red === undefined && bg.green === undefined && bg.blue === undefined)
      const bgColor = isDefault ? null : rgbToHex(bg.red ?? 0, bg.green ?? 0, bg.blue ?? 0)

      return {
        rowIndex: i + 2,
        date: dateStr,
        timeStart: start,
        timeEnd: end,
        location: row[3] || null,
        shopName: row[4] || null,
        address: row[5] || null,
        contactPhone: row[6] || null,
        contactEmail: row[7] || null,
        adMode: row[8] || null,
        assignedTo: row[10] || null,
        forSelf: (row[10] || '').trim() === 'Magának',
        notes: row[13] || null,
        shopCode: row[18] || null,
        strikethrough,
        bgColor,
      }
    })
    .filter((r) => r !== null && r.date != null) as SheetRow[]
}

// Minimal JWT → OAuth2 token exchange for Google APIs
async function getAccessToken(sa: {
  client_email: string
  private_key: string
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = btoa(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })
  )

  const signingInput = `${header}.${payload}`

  // Import private key
  const pemContents = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\n/g, '')

  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0))
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signingInput)
  )

  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
  const jwt = `${signingInput}.${sig}`

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  const tokenData = await tokenRes.json()
  if (!tokenData.access_token) throw new Error('Nem sikerült hozzáférési tokent szerezni')
  return tokenData.access_token
}

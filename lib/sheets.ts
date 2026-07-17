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
}

function parseTime(val: string): { start: string | null; end: string | null } {
  if (!val) return { start: null, end: null }
  const match = val.match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/)
  if (match) return { start: match[1], end: match[2] }
  return { start: val.trim() || null, end: null }
}

function parseDate(val: string): string | null {
  if (!val) return null
  // Handle "2026.03.24." format
  const match = val.match(/(\d{4})\.(\d{2})\.(\d{2})/)
  if (match) return `${match[1]}-${match[2]}-${match[3]}`
  return null
}

export async function fetchSheetRows(tab: string = '2026'): Promise<SheetRow[]> {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON

  if (!spreadsheetId || !serviceAccountJson) {
    throw new Error('GOOGLE_SHEET_ID vagy GOOGLE_SERVICE_ACCOUNT_JSON nincs beállítva')
  }

  let saJson = serviceAccountJson.trim()
  // Strip surrounding quotes if the env var was stored with them
  if ((saJson.startsWith('"') && saJson.endsWith('"')) || (saJson.startsWith("'") && saJson.endsWith("'"))) {
    saJson = saJson.slice(1, -1)
  }
  let sa
  try {
    sa = JSON.parse(saJson)
  } catch {
    // Env vars sometimes store literal newlines inside the private_key string value
    try {
      sa = JSON.parse(saJson.replace(/\n/g, '\\n'))
    } catch (e) {
      console.error('GOOGLE_SERVICE_ACCOUNT_JSON parse failed. First 200 chars:', saJson.slice(0, 200))
      throw e
    }
  }

  // Get access token via JWT
  const token = await getAccessToken(sa)

  const range = encodeURIComponent(`${tab}!A2:S500`)
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Sheets API hiba: ${err}`)
  }

  const data = await res.json()
  const rows: string[][] = data.values || []

  return rows
    .map((row, i) => {
      const dateStr = parseDate(row[0] || '')
      if (!dateStr) return null as unknown as SheetRow

      const { start, end } = parseTime(row[1] || '')

      return {
        rowIndex: i + 2, // 1-indexed, header is row 1
        date: dateStr,
        timeStart: start,
        timeEnd: end,
        location: row[3] || null,
        shopName: row[4] || null,
        address: row[5] || null,
        contactPhone: row[6] || null,
        contactEmail: row[7] || null,
        adMode: row[8] || null,
        assignedTo: row[9] || null,
        forSelf: (row[10] || '').trim() === 'Magának',
        notes: row[13] || null,
        shopCode: row[18] || null,
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

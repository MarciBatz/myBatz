import { NextRequest, NextResponse } from 'next/server'
import { requireSession, unauthorizedResponse } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    await requireSession(request)

    const spreadsheetId = process.env.GOOGLE_SHEET_ID
    const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
    if (!spreadsheetId || !serviceAccountJson) return NextResponse.json({ error: 'missing env' })

    let saJson = serviceAccountJson.trim()
    if ((saJson.startsWith('"') && saJson.endsWith('"')) || (saJson.startsWith("'") && saJson.endsWith("'"))) saJson = saJson.slice(1, -1)
    let sa: { client_email: string; private_key: string }
    try { sa = JSON.parse(saJson) } catch { sa = JSON.parse(saJson.replace(/\n/g, '\\n')) }

    // Reuse token logic inline
    const now = Math.floor(Date.now() / 1000)
    const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
    const payload = btoa(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets.readonly', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }))
    const signingInput = `${header}.${payload}`
    const pemContents = sa.private_key.replace(/-----BEGIN PRIVATE KEY-----/, '').replace(/-----END PRIVATE KEY-----/, '').replace(/\n/g, '')
    const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0))
    const cryptoKey = await crypto.subtle.importKey('pkcs8', binaryKey, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(signingInput))
    const sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
    const jwt = `${signingInput}.${sig}`
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }) })
    const tokenData = await tokenRes.json()
    const token = tokenData.access_token

    // Fetch first 10 rows formatting — no field filter so we see everything
    const fmtRange = encodeURIComponent('2026!A2:A11')
    const fmtUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?includeGridData=true&ranges=${fmtRange}`
    const fmtRes = await fetch(fmtUrl, { headers: { Authorization: `Bearer ${token}` } })
    const fmtData = fmtRes.ok ? await fmtRes.json() : { error: await fmtRes.text() }

    // Return just the rowData portion
    const rowData = fmtData?.sheets?.[0]?.data?.[0]?.rowData ?? fmtData
    return NextResponse.json({ rowData })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorizedResponse()
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

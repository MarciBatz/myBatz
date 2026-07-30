/**
 * Client-safe department definitions: constants, label/colour helpers and types.
 * The server-side access rules live in lib/departments-access.ts so importing
 * these from a client component doesn't pull Prisma into the browser bundle
 * (same split as lib/private-tasks.ts vs lib/private-tasks-auth.ts).
 */

/** Sentinel used in the UI/filters for company-wide tickets. Never a Department row. */
export const COMPANY_WIDE = 'COMPANY_WIDE' as const
export const COMPANY_WIDE_LABEL = 'Teljes cég'
export const COMPANY_WIDE_COLOR = '#0F766E'

/** Name key used for case/accent-insensitive uniqueness. JS toLowerCase is Unicode-aware. */
export function normalizeDepartmentName(name: string): string {
  return name.trim().toLowerCase()
}

export interface DepartmentSummary {
  id: string
  name: string
  color: string
}

const DARK_TEXT = '#111827'
const LIGHT_TEXT = '#FFFFFF'
/** WCAG AA for normal-size text. Badge labels are 12px, so 3:1 is not enough. */
const MIN_CONTRAST = 4.5

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(hex.trim())
  if (!m) return null
  let h = m[1]
  if (h.length === 3) h = h.split('').map(c => c + c).join('')
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)) as [number, number, number]
}

function toHex(rgb: [number, number, number]): string {
  return '#' + rgb.map(c => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, '0')).join('').toUpperCase()
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

function contrastRatio(a: [number, number, number], b: [number, number, number]): number {
  const [l1, l2] = [relativeLuminance(a), relativeLuminance(b)]
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}

/**
 * Picks a readable text colour for a department badge background.
 * Uses the WCAG relative-luminance formula so mid-tone brand colours land on
 * the right side rather than being judged by a naive average.
 */
export function contrastTextColor(hex: string): string {
  const rgb = parseHex(hex)
  if (!rgb) return DARK_TEXT
  const white = contrastRatio(rgb, [255, 255, 255])
  const dark = contrastRatio(rgb, parseHex(DARK_TEXT)!)
  return white >= dark ? LIGHT_TEXT : DARK_TEXT
}

/**
 * Accessible background/text pair for a department badge.
 *
 * Mid-tone colours (e.g. sky #0284C7) reach only ~4.3:1 against *either* white
 * or near-black, so simply picking the better text colour still fails AA. Here
 * the department's own colour is nudged along the black↔white axis — which
 * keeps its hue and reads as the same colour — until the pair clears 4.5:1.
 * Colours that already pass are returned untouched.
 */
export function badgeColors(hex: string): { background: string; text: string } {
  const rgb = parseHex(hex)
  if (!rgb) return { background: '#6C5CE7', text: LIGHT_TEXT }

  const text = contrastTextColor(hex)
  const textRgb = parseHex(text)!
  if (contrastRatio(rgb, textRgb) >= MIN_CONTRAST) return { background: toHex(rgb), text }

  // White text ⇒ darken towards black; dark text ⇒ lighten towards white.
  const target: [number, number, number] = text === LIGHT_TEXT ? [0, 0, 0] : [255, 255, 255]
  for (let step = 1; step <= 40; step++) {
    const t = step / 40
    // Round to whole channels *before* measuring, so the ratio checked here is
    // the ratio of the hex actually emitted — otherwise a fractional colour can
    // clear 4.5:1 and its rounded hex fall just under.
    const mixed = rgb.map((c, i) => Math.round(c + (target[i] - c) * t)) as [number, number, number]
    if (contrastRatio(mixed, textRgb) >= MIN_CONTRAST) return { background: toHex(mixed), text }
  }
  return { background: toHex(target), text }
}

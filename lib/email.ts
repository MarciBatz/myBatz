interface EmailPayload {
  to: string | string[]
  subject: string
  html: string
  text?: string
}

async function sendEmail(payload: EmailPayload): Promise<void> {
  const { to, subject, html } = payload
  const recipients = Array.isArray(to) ? to : [to]

  if (!process.env.EMAIL_API_KEY) {
    console.log('\n=== EMAIL (console fallback) ===')
    console.log('To:', recipients.join(', '))
    console.log('Subject:', subject)
    console.log('Body:', html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
    console.log('================================\n')
    return
  }

  // Resend API
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.EMAIL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'noreply@example.com',
      to: recipients,
      subject,
      html,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('Email send error:', error)
  }
}

export async function sendInviteEmail(
  email: string,
  token: string,
  inviterName: string,
  inviteeName: string
): Promise<void> {
  const appUrl = process.env.APP_URL || 'http://localhost:3000'
  const inviteUrl = `${appUrl}/invite/${token}`

  await sendEmail({
    to: email,
    subject: 'Meghívtak a myBatz rendszerbe',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6C5CE7;">Szia, ${inviteeName}!</h2>
        <p><strong>${inviterName}</strong> meghívott a myBatz belső feladatkezelő rendszerbe.</p>
        <p>Kattints az alábbi gombra a meghívó elfogadásához és a fiókod beállításához:</p>
        <a href="${inviteUrl}" style="display:inline-block;background:#6C5CE7;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0;">
          Meghívó elfogadása
        </a>
        <p style="color:#666;font-size:14px;">A meghívó link 48 óráig érvényes.</p>
        <p style="color:#666;font-size:12px;">Ha a gomb nem működik, másold be ezt a linket: ${inviteUrl}</p>
        <p style="color:#aaa;font-size:12px;margin-top:24px;">myBatz értesítő</p>
      </div>
    `,
  })
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const appUrl = process.env.APP_URL || 'http://localhost:3000'
  const resetUrl = `${appUrl}/reset-password/${token}`

  await sendEmail({
    to: email,
    subject: 'myBatz – Jelszó visszaállítása',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6C5CE7;">Jelszó visszaállítása</h2>
        <p>Jelszó-visszaállítást kértek a myBatz fiókodhoz.</p>
        <p>Kattints az alábbi gombra az új jelszó beállításához:</p>
        <a href="${resetUrl}" style="display:inline-block;background:#6C5CE7;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0;">
          Jelszó visszaállítása
        </a>
        <p style="color:#666;font-size:14px;">A link 1 óráig érvényes. Ha nem te kérted, hagyd figyelmen kívül ezt az emailt.</p>
        <p style="color:#666;font-size:12px;">Ha a gomb nem működik, másold be ezt a linket: ${resetUrl}</p>
        <p style="color:#aaa;font-size:12px;margin-top:24px;">myBatz értesítő</p>
      </div>
    `,
  })
}

const priorityLabels: Record<string, string> = {
  LOW: 'Alacsony',
  MEDIUM: 'Közepes',
  HIGH: 'Magas',
  CRITICAL: 'Kritikus',
}

export async function sendNewTicketEmail(
  users: { email: string; name?: string | null; nickname?: string | null }[],
  ticket: { id: string; title: string; description: string; priority: string },
  createdBy: string
): Promise<void> {
  if (users.length === 0) return

  const appUrl = process.env.APP_URL || 'http://localhost:3000'
  const ticketUrl = `${appUrl}/tickets/${ticket.id}`
  const priorityLabel = priorityLabels[ticket.priority] || ticket.priority

  for (const user of users) {
    const greeting = user.nickname || user.name || 'Kedves Felhasználó'
    await sendEmail({
      to: user.email,
      subject: `Új feladat: ${ticket.title}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #6C5CE7;">Új feladat érkezett</h2>
          <p>Szia ${greeting},</p>
          <p><strong>${createdBy}</strong> új feladatot hozott létre:</p>
          <div style="background:#f8f9fa;border-left:4px solid #6C5CE7;padding:16px;border-radius:4px;margin:16px 0;">
            <strong style="font-size:16px;">${ticket.title}</strong>
            <p style="color:#666;margin:8px 0;">${ticket.description.slice(0, 200)}${ticket.description.length > 200 ? '...' : ''}</p>
            <span style="background:#6C5CE7;color:#fff;padding:2px 10px;border-radius:4px;font-size:12px;">Prioritás: ${priorityLabel}</span>
          </div>
          <a href="${ticketUrl}" style="display:inline-block;background:#6C5CE7;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">
            Feladat megtekintése
          </a>
          <p style="color:#aaa;font-size:12px;margin-top:24px;">myBatz értesítő</p>
        </div>
      `,
    })
  }
}

function cleanMentions(body: string): string {
  return body.replace(/@\[([^\]]+)\]\([^)]+\)/g, (_, name) => `@${name}`)
}

export async function sendNewCommentEmail(
  users: { email: string; name?: string | null; nickname?: string | null }[],
  ticket: { id: string; title: string },
  comment: { body: string; authorName: string }
): Promise<void> {
  if (users.length === 0) return

  const appUrl = process.env.APP_URL || 'http://localhost:3000'
  const ticketUrl = `${appUrl}/tickets/${ticket.id}`

  for (const user of users) {
    const greeting = user.nickname || user.name || 'Kedves Felhasználó'
    await sendEmail({
      to: user.email,
      subject: `Új hozzászólás: ${ticket.title}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #6C5CE7;">Új hozzászólás érkezett</h2>
          <p>Szia ${greeting},</p>
          <p><strong>${comment.authorName}</strong> hozzászólt egy feladathoz amelynek te vagy a felelőse:</p>
          <div style="background:#f8f9fa;border-left:4px solid #6C5CE7;padding:16px;border-radius:4px;margin:16px 0;">
            <p style="color:#888;font-size:12px;margin:0 0 8px;">Feladat: <strong>${ticket.title}</strong></p>
            <p style="margin:0;">${cleanMentions(comment.body).slice(0, 300)}${comment.body.length > 300 ? '...' : ''}</p>
          </div>
          <a href="${ticketUrl}" style="display:inline-block;background:#6C5CE7;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">
            Feladat megtekintése
          </a>
          <p style="color:#aaa;font-size:12px;margin-top:24px;">myBatz értesítő</p>
        </div>
      `,
    })
  }
}

export async function sendTicketUpdateEmail(
  users: { email: string; name?: string | null; nickname?: string | null }[],
  ticket: { id: string; title: string },
  changes: string
): Promise<void> {
  if (users.length === 0) return

  const appUrl = process.env.APP_URL || 'http://localhost:3000'
  const ticketUrl = `${appUrl}/tickets/${ticket.id}`

  for (const user of users) {
    const greeting = user.nickname || user.name || 'Kedves Felhasználó'
    await sendEmail({
      to: user.email,
      subject: `Feladat frissült: ${ticket.title}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #6C5CE7;">Feladat frissült</h2>
          <p>Szia ${greeting},</p>
          <p>Egy feladat amelyet követsz frissült:</p>
          <div style="background:#f8f9fa;border-left:4px solid #6C5CE7;padding:16px;border-radius:4px;margin:16px 0;">
            <strong>${ticket.title}</strong>
            <p style="color:#666;margin:8px 0 0;">${changes}</p>
          </div>
          <a href="${ticketUrl}" style="display:inline-block;background:#6C5CE7;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">
            Feladat megtekintése
          </a>
          <p style="color:#aaa;font-size:12px;margin-top:24px;">myBatz értesítő</p>
        </div>
      `,
    })
  }
}

export async function sendTicketReminderEmail(
  user: { email: string; name?: string | null; nickname?: string | null },
  ticket: { id: string; title: string; createdAt: Date },
  days: number
): Promise<void> {
  const appUrl = process.env.APP_URL || 'http://localhost:3000'
  const ticketUrl = `${appUrl}/tickets/${ticket.id}`
  const greeting = user.nickname || user.name || 'Kedves Felhasználó'

  await sendEmail({
    to: user.email,
    subject: `Emlékeztető: "${ticket.title}" – ${days} napja megoldatlan`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6C5CE7;">Emlékeztető – megoldatlan feladat</h2>
        <p>Szia ${greeting},</p>
        <p>Az alábbi feladat már <strong>${days} napja</strong> megoldatlan, és te vagy a felelőse:</p>
        <div style="background:#fff8e1;border-left:4px solid #f39c12;padding:16px;border-radius:4px;margin:16px 0;">
          <strong style="font-size:16px;">${ticket.title}</strong>
          <p style="color:#888;font-size:13px;margin:6px 0 0;">Létrehozva: ${ticket.createdAt.toLocaleDateString('hu-HU')}</p>
        </div>
        <a href="${ticketUrl}" style="display:inline-block;background:#6C5CE7;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">
          Feladat megtekintése
        </a>
        <p style="color:#aaa;font-size:12px;margin-top:24px;">myBatz értesítő</p>
      </div>
    `,
  })
}

export async function sendNudgeEmail(
  user: { email: string; name?: string | null; nickname?: string | null },
  ticket: { id: string; title: string },
  senderName: string
): Promise<void> {
  const appUrl = process.env.APP_URL || 'http://localhost:3001'
  const ticketUrl = `${appUrl}/tickets/${ticket.id}`
  const greeting = user.nickname || user.name || 'Kedves Felhasználó'

  await sendEmail({
    to: user.email,
    subject: `Emlékeztető: "${ticket.title}"`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6C5CE7;">Cselekvés szükséges</h2>
        <p>Szia ${greeting},</p>
        <p><strong>${senderName}</strong> jelezte feléd, hogy az alábbi feladattal foglalkozni kell:</p>
        <div style="background:#fff3cd;border-left:4px solid #f39c12;padding:16px;border-radius:4px;margin:16px 0;">
          <strong style="font-size:16px;">${ticket.title}</strong>
        </div>
        <a href="${ticketUrl}" style="display:inline-block;background:#6C5CE7;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">
          Feladat megtekintése
        </a>
        <p style="color:#aaa;font-size:12px;margin-top:24px;">myBatz értesítő</p>
      </div>
    `,
  })
}

export async function sendSlaBreachEmail(
  user: { email: string; name?: string | null; nickname?: string | null },
  ticket: { id: string; title: string },
  type: 'no_response' | 'unassigned'
): Promise<void> {
  const appUrl = process.env.APP_URL || 'http://localhost:3000'
  const ticketUrl = `${appUrl}/tickets/${ticket.id}`
  const greeting = user.nickname || user.name || 'Kedves Felhasználó'

  const subject = type === 'no_response'
    ? `48 órája nem reagáltál: "${ticket.title}"`
    : `48 órája gazdátlan feladat: "${ticket.title}"`

  const body = type === 'no_response'
    ? `<p>Az alábbi feladatra <strong>48 órája nem reagáltál</strong>, pedig te vagy a felelőse. Kérjük, nézd meg és frissítsd az állapotát.</p>`
    : `<p>Az alábbi feladatot <strong>48 órája senki sem vette fel magának</strong>. Kérjük, rendelj hozzá felelőst, vagy vállald el magad.</p>`

  await sendEmail({
    to: user.email,
    subject,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #e17055;">Válaszidő figyelmeztetés</h2>
        <p>Szia ${greeting},</p>
        ${body}
        <div style="background:#fff0f0;border-left:4px solid #e17055;padding:16px;border-radius:4px;margin:16px 0;">
          <strong style="font-size:16px;">${ticket.title}</strong>
        </div>
        <a href="${ticketUrl}" style="display:inline-block;background:#e17055;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">
          Feladat megtekintése
        </a>
        <p style="color:#aaa;font-size:12px;margin-top:24px;">myBatz értesítő</p>
      </div>
    `,
  })
}

const roleLabels: Record<string, string> = {
  ADMIN: 'Adminisztrátor',
  AGENT: 'Felhasználó',
  READER: 'Olvasó',
}

export async function sendRoleChangedEmail(
  user: { email: string; name?: string | null; firstName?: string | null; nickname?: string | null },
  oldRole: string,
  newRole: string
): Promise<void> {
  const greeting = user.nickname || user.firstName || user.name || 'Felhasználó'
  await sendEmail({
    to: user.email,
    subject: 'myBatz – Szerepköröd megváltozott',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6C5CE7;">Szerepkör változás</h2>
        <p>Szia ${greeting},</p>
        <p>A myBatz rendszerben a szerepköröd megváltozott:</p>
        <div style="background:#f8f7ff;border-left:4px solid #6C5CE7;padding:16px;border-radius:4px;margin:16px 0;">
          <span style="color:#999;font-size:14px;">${roleLabels[oldRole] || oldRole}</span>
          <span style="margin:0 10px;color:#6C5CE7;font-weight:bold;">→</span>
          <span style="color:#6C5CE7;font-weight:bold;font-size:16px;">${roleLabels[newRole] || newRole}</span>
        </div>
        <p style="color:#666;font-size:14px;">Ha kérdésed van, lépj kapcsolatba az adminisztrátorral.</p>
        <p style="color:#aaa;font-size:12px;margin-top:24px;">myBatz értesítő</p>
      </div>
    `,
  })
}

export async function sendCalendarEventNotificationEmail(
  recipient: { email: string; name?: string | null; firstName?: string | null; nickname?: string | null },
  event: { title: string; date: Date; description?: string | null },
  senderName: string
): Promise<void> {
  const greeting = recipient.nickname || recipient.firstName || recipient.name || 'Kolléga'
  const dateLabel = event.date.toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })
  await sendEmail({
    to: recipient.email,
    subject: `Naptár: ${event.title}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #14B8A6;">📅 Naptáresemény értesítő</h2>
        <p>Szia ${greeting},</p>
        <p><strong>${senderName}</strong> értesítőt küldött a következő eseményről:</p>
        <div style="background:#f0fdfa;border-left:4px solid #14B8A6;padding:16px;border-radius:8px;margin:16px 0;">
          <p style="font-size:18px;font-weight:bold;margin:0 0 8px;">${event.title}</p>
          <p style="color:#666;margin:0;">📅 ${dateLabel}</p>
          ${event.description ? `<p style="color:#444;margin:12px 0 0;">${event.description}</p>` : ''}
        </div>
        <p style="color:#aaa;font-size:12px;margin-top:24px;">myBatz értesítő</p>
      </div>
    `,
  })
}

// Renders the changelog's lightweight markup (## / ### / - / **bold**) as email HTML
function renderChangelogHtml(content: string): string {
  const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const inline = (s: string) => escape(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  const lines = content.split('\n')
  const out: string[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i].trim()
    if (!line) { i++; continue }
    if (line.startsWith('### ')) {
      out.push(`<h3 style="font-size:14px;color:#374151;margin:16px 0 6px;">${inline(line.slice(4))}</h3>`)
    } else if (line.startsWith('## ')) {
      out.push(`<h2 style="font-size:16px;color:#111827;margin:20px 0 8px;">${inline(line.slice(3))}</h2>`)
    } else if (line.startsWith('- ')) {
      const items: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('- ')) {
        items.push(lines[i].trim().slice(2))
        i++
      }
      out.push(`<ul style="margin:0 0 12px;padding-left:20px;color:#4b5563;line-height:1.8;">${items.map(it => `<li>${inline(it)}</li>`).join('')}</ul>`)
      continue
    } else {
      out.push(`<p style="color:#4b5563;margin:0 0 8px;">${inline(line)}</p>`)
    }
    i++
  }
  return out.join('')
}

export async function sendChangelogEmail(
  recipient: { email: string; name?: string | null; firstName?: string | null; nickname?: string | null },
  entry: { version: string; title: string; content: string },
  senderName: string
): Promise<void> {
  const greeting = recipient.nickname || recipient.firstName || recipient.name || 'Kolléga'
  const appUrl = process.env.APP_URL || 'http://localhost:3000'
  await sendEmail({
    to: recipient.email,
    subject: `myBatz újdonságok – ${entry.version} ${entry.title}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6C5CE7;">✨ Újdonságok a myBatz-ban</h2>
        <p>Szia ${greeting},</p>
        <p><strong>${senderName}</strong> új changelog bejegyzést tett közzé:</p>
        <div style="background:#f5f3ff;border-left:4px solid #6C5CE7;padding:16px;border-radius:8px;margin:16px 0;">
          <p style="margin:0 0 4px;">
            <span style="display:inline-block;background:#6C5CE7;color:#fff;font-size:12px;font-weight:bold;padding:2px 10px;border-radius:999px;">${entry.version}</span>
          </p>
          <p style="font-size:18px;font-weight:bold;margin:8px 0 12px;">${entry.title}</p>
          ${renderChangelogHtml(entry.content)}
        </div>
        <p><a href="${appUrl}/changelog" style="color:#6C5CE7;">Megnyitás a myBatz-ban →</a></p>
        <p style="color:#aaa;font-size:12px;margin-top:24px;">myBatz értesítő</p>
      </div>
    `,
  })
}

export async function sendOfficeWeekReminderEmail(
  user: { email: string; name?: string | null; firstName?: string | null; nickname?: string | null },
  weekStart: Date
): Promise<void> {
  const greeting = user.nickname || user.firstName || user.name || 'Kolléga'
  const weekLabel = weekStart.toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' })
  await sendEmail({
    to: user.email,
    subject: 'Ezen a héten te vagy az irodai hetes 🧹',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6C5CE7;">Irodai hetes emlékeztető</h2>
        <p>Szia ${greeting},</p>
        <p>Emlékeztetőül: ezen a héten (${weekLabel}től) <strong>te vagy az irodai hetes</strong>.</p>
        <p style="font-weight:bold; margin-top:20px;">Feladataid erre a hétre:</p>
        <ul style="line-height:2; color:#333;">
          <li>Konyha tisztántartása (pult, asztal, csepegtető alatt törlés)</li>
          <li>Ebéd után a mosogatógép elindítása, délután/másnap reggel kipakolása</li>
          <li>Csepegtetőn lévő elmosott dolgok elpakolása</li>
          <li>Mikró takarítása</li>
          <li>Kuka napi ürítése</li>
        </ul>
        <p style="color:#666; font-size:14px;">Köszönjük a közreműködést! 🙏</p>
        <p style="color:#aaa; font-size:12px; margin-top:24px;">myBatz értesítő</p>
      </div>
    `,
  })
}

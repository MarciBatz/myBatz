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
  inviterName: string
): Promise<void> {
  const appUrl = process.env.APP_URL || 'http://localhost:3000'
  const inviteUrl = `${appUrl}/invite/${token}`

  await sendEmail({
    to: email,
    subject: 'Meghívtak a myBatz Beta rendszerbe',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6C5CE7;">Meghívtak!</h2>
        <p><strong>${inviterName}</strong> meghívott a myBatz Beta belső hibajegy-kezelő rendszerbe.</p>
        <p>Kattints az alábbi gombra a meghívó elfogadásához és a fiókod beállításához:</p>
        <a href="${inviteUrl}" style="display:inline-block;background:#6C5CE7;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0;">
          Meghívó elfogadása
        </a>
        <p style="color:#666;font-size:14px;">A meghívó link 48 óráig érvényes.</p>
        <p style="color:#666;font-size:12px;">Ha a gomb nem működik, másold be ezt a linket: ${inviteUrl}</p>
        <p style="color:#aaa;font-size:12px;margin-top:24px;">myBatz Beta értesítő</p>
      </div>
    `,
  })
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const appUrl = process.env.APP_URL || 'http://localhost:3000'
  const resetUrl = `${appUrl}/reset-password/${token}`

  await sendEmail({
    to: email,
    subject: 'myBatz Beta – Jelszó visszaállítása',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6C5CE7;">Jelszó visszaállítása</h2>
        <p>Jelszó-visszaállítást kértek a myBatz Beta fiókodhoz.</p>
        <p>Kattints az alábbi gombra az új jelszó beállításához:</p>
        <a href="${resetUrl}" style="display:inline-block;background:#6C5CE7;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0;">
          Jelszó visszaállítása
        </a>
        <p style="color:#666;font-size:14px;">A link 1 óráig érvényes. Ha nem te kérted, hagyd figyelmen kívül ezt az emailt.</p>
        <p style="color:#666;font-size:12px;">Ha a gomb nem működik, másold be ezt a linket: ${resetUrl}</p>
        <p style="color:#aaa;font-size:12px;margin-top:24px;">myBatz Beta értesítő</p>
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
      subject: `Új ticket: ${ticket.title}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #6C5CE7;">Új ticket érkezett</h2>
          <p>Szia ${greeting},</p>
          <p><strong>${createdBy}</strong> új ticketet hozott létre:</p>
          <div style="background:#f8f9fa;border-left:4px solid #6C5CE7;padding:16px;border-radius:4px;margin:16px 0;">
            <strong style="font-size:16px;">${ticket.title}</strong>
            <p style="color:#666;margin:8px 0;">${ticket.description.slice(0, 200)}${ticket.description.length > 200 ? '...' : ''}</p>
            <span style="background:#6C5CE7;color:#fff;padding:2px 10px;border-radius:4px;font-size:12px;">Prioritás: ${priorityLabel}</span>
          </div>
          <a href="${ticketUrl}" style="display:inline-block;background:#6C5CE7;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">
            Ticket megtekintése
          </a>
          <p style="color:#aaa;font-size:12px;margin-top:24px;">myBatz Beta értesítő</p>
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
          <p><strong>${comment.authorName}</strong> hozzászólt egy tickethez amelynek te vagy a felelőse:</p>
          <div style="background:#f8f9fa;border-left:4px solid #6C5CE7;padding:16px;border-radius:4px;margin:16px 0;">
            <p style="color:#888;font-size:12px;margin:0 0 8px;">Ticket: <strong>${ticket.title}</strong></p>
            <p style="margin:0;">${cleanMentions(comment.body).slice(0, 300)}${comment.body.length > 300 ? '...' : ''}</p>
          </div>
          <a href="${ticketUrl}" style="display:inline-block;background:#6C5CE7;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">
            Ticket megtekintése
          </a>
          <p style="color:#aaa;font-size:12px;margin-top:24px;">myBatz Beta értesítő</p>
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
      subject: `Ticket frissült: ${ticket.title}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #6C5CE7;">Ticket frissült</h2>
          <p>Szia ${greeting},</p>
          <p>Egy ticket amelyet követsz frissült:</p>
          <div style="background:#f8f9fa;border-left:4px solid #6C5CE7;padding:16px;border-radius:4px;margin:16px 0;">
            <strong>${ticket.title}</strong>
            <p style="color:#666;margin:8px 0 0;">${changes}</p>
          </div>
          <a href="${ticketUrl}" style="display:inline-block;background:#6C5CE7;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">
            Ticket megtekintése
          </a>
          <p style="color:#aaa;font-size:12px;margin-top:24px;">myBatz Beta értesítő</p>
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
        <h2 style="color: #6C5CE7;">Emlékeztető – megoldatlan ticket</h2>
        <p>Szia ${greeting},</p>
        <p>Az alábbi ticket már <strong>${days} napja</strong> megoldatlan, és te vagy a felelőse:</p>
        <div style="background:#fff8e1;border-left:4px solid #f39c12;padding:16px;border-radius:4px;margin:16px 0;">
          <strong style="font-size:16px;">${ticket.title}</strong>
          <p style="color:#888;font-size:13px;margin:6px 0 0;">Létrehozva: ${ticket.createdAt.toLocaleDateString('hu-HU')}</p>
        </div>
        <a href="${ticketUrl}" style="display:inline-block;background:#6C5CE7;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">
          Ticket megtekintése
        </a>
        <p style="color:#aaa;font-size:12px;margin-top:24px;">myBatz Beta értesítő</p>
      </div>
    `,
  })
}

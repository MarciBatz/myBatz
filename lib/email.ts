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
    subject: 'You have been invited to join the Helpdesk',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6C5CE7;">You're invited!</h2>
        <p><strong>${inviterName}</strong> has invited you to join the Helpdesk system.</p>
        <p>Click the button below to accept the invitation and set up your account:</p>
        <a href="${inviteUrl}" style="display:inline-block;background:#6C5CE7;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0;">
          Accept Invitation
        </a>
        <p style="color:#666;font-size:14px;">This invitation link expires in 48 hours.</p>
        <p style="color:#666;font-size:12px;">If the button doesn't work, copy this link: ${inviteUrl}</p>
      </div>
    `,
  })
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const appUrl = process.env.APP_URL || 'http://localhost:3000'
  const resetUrl = `${appUrl}/reset-password/${token}`

  await sendEmail({
    to: email,
    subject: 'Reset your Helpdesk password',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6C5CE7;">Password Reset</h2>
        <p>You requested a password reset for your Helpdesk account.</p>
        <p>Click the button below to set a new password:</p>
        <a href="${resetUrl}" style="display:inline-block;background:#6C5CE7;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0;">
          Reset Password
        </a>
        <p style="color:#666;font-size:14px;">This link expires in 1 hour. If you did not request this, you can safely ignore this email.</p>
        <p style="color:#666;font-size:12px;">If the button doesn't work, copy this link: ${resetUrl}</p>
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
            <p style="margin:0;">${comment.body.slice(0, 300)}${comment.body.length > 300 ? '...' : ''}</p>
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

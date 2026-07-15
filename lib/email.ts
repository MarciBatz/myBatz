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

export async function sendNewTicketEmail(
  users: { email: string; name?: string | null }[],
  ticket: { id: string; title: string; description: string; priority: string }
): Promise<void> {
  if (users.length === 0) return

  const appUrl = process.env.APP_URL || 'http://localhost:3000'
  const ticketUrl = `${appUrl}/tickets/${ticket.id}`

  for (const user of users) {
    await sendEmail({
      to: user.email,
      subject: `New Ticket: ${ticket.title}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #6C5CE7;">New Ticket Assigned</h2>
          <p>Hi ${user.name || 'there'},</p>
          <p>A new ticket has been assigned to you:</p>
          <div style="background:#f8f9fa;border-left:4px solid #6C5CE7;padding:16px;border-radius:4px;margin:16px 0;">
            <strong>${ticket.title}</strong>
            <p style="color:#666;margin:8px 0 0;">${ticket.description.slice(0, 200)}${ticket.description.length > 200 ? '...' : ''}</p>
            <span style="background:#6C5CE7;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;">${ticket.priority}</span>
          </div>
          <a href="${ticketUrl}" style="display:inline-block;background:#6C5CE7;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">
            View Ticket
          </a>
        </div>
      `,
    })
  }
}

export async function sendTicketUpdateEmail(
  users: { email: string; name?: string | null }[],
  ticket: { id: string; title: string },
  changes: string
): Promise<void> {
  if (users.length === 0) return

  const appUrl = process.env.APP_URL || 'http://localhost:3000'
  const ticketUrl = `${appUrl}/tickets/${ticket.id}`

  for (const user of users) {
    await sendEmail({
      to: user.email,
      subject: `Ticket Updated: ${ticket.title}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #6C5CE7;">Ticket Updated</h2>
          <p>Hi ${user.name || 'there'},</p>
          <p>A ticket you are following has been updated:</p>
          <div style="background:#f8f9fa;border-left:4px solid #6C5CE7;padding:16px;border-radius:4px;margin:16px 0;">
            <strong>${ticket.title}</strong>
            <p style="color:#666;margin:8px 0 0;">${changes}</p>
          </div>
          <a href="${ticketUrl}" style="display:inline-block;background:#6C5CE7;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">
            View Ticket
          </a>
        </div>
      `,
    })
  }
}

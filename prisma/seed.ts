import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'

// These are string constants matching the Prisma enum values
const Role = { ADMIN: 'ADMIN', AGENT: 'AGENT' } as const
const UserStatus = { INVITED: 'INVITED', ACTIVE: 'ACTIVE', DISABLED: 'DISABLED' } as const
const TicketStatus = { OPEN: 'OPEN', IN_PROGRESS: 'IN_PROGRESS', AWAITING: 'AWAITING', CLOSED: 'CLOSED' } as const
const Priority = { LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH', CRITICAL: 'CRITICAL' } as const

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Seeding database...')

  // Create users
  const adminHash = await bcrypt.hash('Admin123!', 12)
  const agentHash = await bcrypt.hash('Agent123!', 12)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: 'Admin User',
      passwordHash: adminHash,
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
    },
  })

  const alice = await prisma.user.upsert({
    where: { email: 'alice@example.com' },
    update: {},
    create: {
      email: 'alice@example.com',
      name: 'Alice Johnson',
      passwordHash: agentHash,
      role: Role.AGENT,
      status: UserStatus.ACTIVE,
    },
  })

  const bob = await prisma.user.upsert({
    where: { email: 'bob@example.com' },
    update: {},
    create: {
      email: 'bob@example.com',
      name: 'Bob Smith',
      passwordHash: agentHash,
      role: Role.AGENT,
      status: UserStatus.ACTIVE,
    },
  })

  const carol = await prisma.user.upsert({
    where: { email: 'carol@example.com' },
    update: {},
    create: {
      email: 'carol@example.com',
      name: 'Carol Davis',
      passwordHash: agentHash,
      role: Role.AGENT,
      status: UserStatus.ACTIVE,
    },
  })

  console.log('Users created')

  // Create categories
  const categories = await Promise.all([
    prisma.category.upsert({ where: { name: 'Bug' }, update: {}, create: { name: 'Bug' } }),
    prisma.category.upsert({ where: { name: 'Feature Request' }, update: {}, create: { name: 'Feature Request' } }),
    prisma.category.upsert({ where: { name: 'Support' }, update: {}, create: { name: 'Support' } }),
    prisma.category.upsert({ where: { name: 'Infrastructure' }, update: {}, create: { name: 'Infrastructure' } }),
    prisma.category.upsert({ where: { name: 'Security' }, update: {}, create: { name: 'Security' } }),
  ])

  const [bugCat, featureCat, supportCat, infraCat, securityCat] = categories
  console.log('Categories created')

  // Create sample tickets
  const ticketsData = [
    {
      title: 'Login page crashes on mobile Safari',
      description: 'Users on iPhone Safari 16+ are experiencing a white screen crash when navigating to the login page. The issue seems related to the CSS flexbox implementation.',
      status: TicketStatus.OPEN,
      priority: Priority.CRITICAL,
      categoryId: bugCat.id,
      assigneeId: alice.id,
      createdById: admin.id,
    },
    {
      title: 'Add dark mode support',
      description: 'Multiple users have requested a dark mode option for the dashboard. This would improve usability in low-light environments and reduce eye strain.',
      status: TicketStatus.OPEN,
      priority: Priority.MEDIUM,
      categoryId: featureCat.id,
      assigneeId: bob.id,
      createdById: admin.id,
    },
    {
      title: 'Database backup failing at midnight',
      description: 'The automated nightly backup job has been failing since the last server update. Error logs show a timeout connection issue with the backup storage service.',
      status: TicketStatus.IN_PROGRESS,
      priority: Priority.HIGH,
      categoryId: infraCat.id,
      assigneeId: alice.id,
      createdById: alice.id,
    },
    {
      title: 'Password reset email not delivered',
      description: 'Several users reported not receiving password reset emails. The email service logs show the messages are being sent but not received. Possible spam filtering issue.',
      status: TicketStatus.AWAITING,
      priority: Priority.HIGH,
      categoryId: supportCat.id,
      assigneeId: carol.id,
      createdById: bob.id,
    },
    {
      title: 'CSV export missing last column',
      description: 'When exporting reports to CSV format, the last column (Total Amount) is consistently missing from the output file. This affects all report types.',
      status: TicketStatus.CLOSED,
      priority: Priority.MEDIUM,
      categoryId: bugCat.id,
      assigneeId: bob.id,
      createdById: carol.id,
    },
    {
      title: 'Implement two-factor authentication',
      description: 'Security audit has recommended adding 2FA support for all admin accounts. We should support TOTP authenticator apps and SMS as fallback.',
      status: TicketStatus.OPEN,
      priority: Priority.HIGH,
      categoryId: securityCat.id,
      assigneeId: alice.id,
      createdById: admin.id,
    },
    {
      title: 'API rate limiting not working correctly',
      description: 'The current rate limiting implementation allows bursts above the configured threshold. Under heavy load, some endpoints accept 2-3x the allowed requests per minute.',
      status: TicketStatus.IN_PROGRESS,
      priority: Priority.HIGH,
      categoryId: bugCat.id,
      assigneeId: carol.id,
      createdById: admin.id,
    },
    {
      title: 'Add bulk ticket operations',
      description: 'Agents need the ability to select multiple tickets and perform bulk operations like status change, priority update, or reassignment to improve workflow efficiency.',
      status: TicketStatus.OPEN,
      priority: Priority.LOW,
      categoryId: featureCat.id,
      assigneeId: bob.id,
      createdById: alice.id,
    },
    {
      title: 'SSL certificate renewal',
      description: 'The SSL certificate for api.example.com expires in 30 days. Need to renew and update the certificate before expiry to avoid service disruption.',
      status: TicketStatus.AWAITING,
      priority: Priority.CRITICAL,
      categoryId: infraCat.id,
      assigneeId: alice.id,
      createdById: alice.id,
    },
    {
      title: 'User cannot update profile picture',
      description: 'Users are reporting that uploaded profile pictures are not saving. The upload appears to succeed but after page refresh the old picture is shown again.',
      status: TicketStatus.CLOSED,
      priority: Priority.LOW,
      categoryId: supportCat.id,
      assigneeId: carol.id,
      createdById: bob.id,
    },
  ]

  const tickets = []
  for (const data of ticketsData) {
    const ticket = await prisma.ticket.create({ data })
    tickets.push(ticket)
  }

  console.log('Tickets created')

  // Add comments
  await prisma.comment.createMany({
    data: [
      {
        ticketId: tickets[0].id,
        userId: alice.id,
        body: 'I can reproduce this on my iPhone 14. The error appears in the console: "Cannot read property of undefined". Investigating the auth state initialization.',
      },
      {
        ticketId: tickets[0].id,
        userId: admin.id,
        body: 'This is blocking several mobile users. Please prioritize the fix.',
        isInternal: true,
      },
      {
        ticketId: tickets[2].id,
        userId: alice.id,
        body: 'Found the root cause - the backup service credentials were rotated during the server update but the configuration was not updated. Working on the fix now.',
      },
      {
        ticketId: tickets[2].id,
        userId: admin.id,
        body: 'Updated credentials in the config. Running a manual backup to verify the fix.',
      },
      {
        ticketId: tickets[4].id,
        userId: bob.id,
        body: 'Fixed in v2.3.1. The issue was an off-by-one error in the column iterator. Deployed to production.',
      },
      {
        ticketId: tickets[6].id,
        userId: carol.id,
        body: 'Identified the issue - the sliding window counter was not being properly reset. Implementing a Redis-based solution for accurate rate tracking.',
        isInternal: true,
      },
    ],
  })

  // Add activity logs
  await prisma.activityLog.createMany({
    data: [
      {
        ticketId: tickets[0].id,
        userId: admin.id,
        action: 'created',
        newValue: 'Ticket created',
      },
      {
        ticketId: tickets[0].id,
        userId: alice.id,
        action: 'status_changed',
        oldValue: 'OPEN',
        newValue: 'IN_PROGRESS',
      },
      {
        ticketId: tickets[2].id,
        userId: alice.id,
        action: 'created',
        newValue: 'Ticket created',
      },
      {
        ticketId: tickets[4].id,
        userId: bob.id,
        action: 'status_changed',
        oldValue: 'IN_PROGRESS',
        newValue: 'CLOSED',
      },
      {
        ticketId: tickets[6].id,
        userId: admin.id,
        action: 'priority_changed',
        oldValue: 'MEDIUM',
        newValue: 'HIGH',
      },
    ],
  })

  // Add some saved replies
  await prisma.savedReply.createMany({
    data: [
      {
        title: 'Acknowledgement',
        body: 'Thank you for reaching out. We have received your ticket and will investigate shortly. You can expect an update within 24 hours.',
        createdById: admin.id,
      },
      {
        title: 'Request for more information',
        body: 'Thank you for the report. To better assist you, could you please provide the following additional information:\n\n1. Steps to reproduce the issue\n2. Browser/OS version\n3. Any error messages seen\n\nThank you!',
        createdById: admin.id,
      },
      {
        title: 'Resolution confirmation',
        body: 'We have resolved the issue you reported. The fix has been deployed. Please verify that everything is working as expected on your end. If you continue to experience issues, please let us know and we will reopen this ticket.',
        createdById: alice.id,
      },
    ],
  })

  console.log('Seed completed successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

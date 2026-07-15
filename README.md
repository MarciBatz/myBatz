# Helpdesk — Internal Ticket Management System

A full-featured internal helpdesk built with Next.js 16, TypeScript, Tailwind CSS, and PostgreSQL.

## Features

- Invite-only authentication (JWT/cookie sessions, bcrypt passwords)
- Ticket management with status, priority, category, and assignee
- Inline editing on ticket detail page
- Comment threads with internal notes
- File attachments (local filesystem in dev, S3-ready)
- Activity log per ticket and global
- Email notifications (console fallback when no API key)
- Saved reply templates
- Admin panel: invite users, manage categories, toggle user status
- Responsive design (sidebar collapses on mobile)

## Tech Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS v4
- PostgreSQL + Prisma ORM
- JWT auth (httpOnly cookies)
- bcryptjs for password hashing
- Zod for validation
- Resend for email (console fallback)

## Prerequisites

- Node.js 18+
- PostgreSQL running locally

## Setup

### 1. Install dependencies

```bash
cd ticket-system
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and update values:

```bash
cp .env.example .env
```

Key variables:
- `DATABASE_URL` — PostgreSQL connection string
- `AUTH_SECRET` — at least 32 random characters (used for JWT signing)
- `EMAIL_API_KEY` — Resend API key (leave blank to use console fallback)
- `EMAIL_FROM` — sender address for emails
- `APP_URL` — your app URL (for email links)

### 3. Set up the database

```bash
npx prisma migrate dev --name init
```

### 4. Seed the database

```bash
npx prisma db seed
```

### 5. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Default Credentials

| Role  | Email               | Password   |
|-------|---------------------|------------|
| Admin | admin@example.com   | Admin123!  |
| Agent | alice@example.com   | Agent123!  |
| Agent | bob@example.com     | Agent123!  |
| Agent | carol@example.com   | Agent123!  |

## Usage

1. Log in with the admin account
2. The dashboard shows ticket stats and a filterable ticket list
3. Click any ticket to view details, edit status/priority/assignee inline, and add comments
4. Go to **Agents** to invite new team members (admin only)
5. Go to **Settings** to manage categories and your profile
6. Go to **Saved Replies** to create reusable response templates

## File Storage

In development, uploaded files are saved to `public/uploads/`.
For production, set `STORAGE_PROVIDER=s3` and configure the S3 environment variables.

## Email

If `EMAIL_API_KEY` is not set, all emails are printed to the server console. To use Resend, add your API key to `.env`.

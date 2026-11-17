-- Extra colleagues on a public ticket, plus an optional deadline and its
-- reminder email.
--
-- Everything here is additive: one new table and three nullable columns. No
-- existing row is read, rewritten or deleted, and every existing row stays
-- valid at every point — so the old code keeps working against the new schema
-- while a deploy is in flight.

-- 1. Deadline + reminder on the ticket ----------------------------------------
-- Nullable with no default: a ticket without a deadline is the normal case, and
-- backfilling one would invent a date nobody chose.
ALTER TABLE "Ticket" ADD COLUMN "dueDate" TIMESTAMP(3);
ALTER TABLE "Ticket" ADD COLUMN "reminderDaysBefore" INTEGER;
ALTER TABLE "Ticket" ADD COLUMN "reminderSentAt" TIMESTAMP(3);

-- 2. Collaborators -------------------------------------------------------------
CREATE TABLE "TicketCollaborator" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    -- Null for a self-join, and null once the adding account is deleted.
    "addedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketCollaborator_pkey" PRIMARY KEY ("id")
);

-- One row per person per ticket. This is what makes "join" idempotent: a second
-- attempt fails on the constraint rather than silently duplicating the grant.
CREATE UNIQUE INDEX "TicketCollaborator_ticketId_userId_key"
    ON "TicketCollaborator"("ticketId", "userId");

-- Collaboration now takes part in the ticket access rule, so the lookup by user
-- runs on every ticket list query for a non-admin.
CREATE INDEX "TicketCollaborator_userId_idx" ON "TicketCollaborator"("userId");

-- Cascade on both: the rows describe a pairing, so losing either side leaves
-- nothing to keep. addedById is only a record of who pulled the person in, so it
-- is set null rather than taking the collaboration down with the account.
ALTER TABLE "TicketCollaborator" ADD CONSTRAINT "TicketCollaborator_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TicketCollaborator" ADD CONSTRAINT "TicketCollaborator_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TicketCollaborator" ADD CONSTRAINT "TicketCollaborator_addedById_fkey"
    FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. The draft keeps the deadline too -----------------------------------------
-- Otherwise a deadline typed into the new-ticket form would vanish when the
-- autosaved draft is reloaded. Stored as text in the draft, the way the date
-- input holds it: a half-filled form is not yet a date.
ALTER TABLE "TicketDraft" ADD COLUMN "dueDate" TEXT;
ALTER TABLE "TicketDraft" ADD COLUMN "reminderDaysBefore" INTEGER;

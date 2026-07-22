-- Private per-user task board, optionally linked to a public ticket.

CREATE TYPE "PrivateTaskColumn" AS ENUM ('TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE');

CREATE TABLE "PrivateTask" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "column" "PrivateTaskColumn" NOT NULL DEFAULT 'TODO',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "dueDate" TIMESTAMP(3),
    "position" INTEGER NOT NULL DEFAULT 0,
    "ticketId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrivateTask_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PrivateTask_userId_column_idx" ON "PrivateTask"("userId", "column");
CREATE INDEX "PrivateTask_ticketId_idx" ON "PrivateTask"("ticketId");

ALTER TABLE "PrivateTask" ADD CONSTRAINT "PrivateTask_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PrivateTask" ADD CONSTRAINT "PrivateTask_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Archiving + lifecycle history for private tasks.

ALTER TABLE "PrivateTask" ADD COLUMN "doneAt" TIMESTAMP(3);
ALTER TABLE "PrivateTask" ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "PrivateTask_userId_archivedAt_idx" ON "PrivateTask"("userId", "archivedAt");

CREATE TABLE "PrivateTaskEvent" (
    "id" TEXT NOT NULL,
    "privateTaskId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fromColumn" "PrivateTaskColumn",
    "toColumn" "PrivateTaskColumn",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrivateTaskEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PrivateTaskEvent_privateTaskId_idx" ON "PrivateTaskEvent"("privateTaskId");

ALTER TABLE "PrivateTaskEvent" ADD CONSTRAINT "PrivateTaskEvent_privateTaskId_fkey"
    FOREIGN KEY ("privateTaskId") REFERENCES "PrivateTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

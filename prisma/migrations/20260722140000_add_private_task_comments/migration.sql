-- Progress notes on a private task.

CREATE TABLE "PrivateTaskComment" (
    "id" TEXT NOT NULL,
    "privateTaskId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrivateTaskComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PrivateTaskComment_privateTaskId_idx" ON "PrivateTaskComment"("privateTaskId");

ALTER TABLE "PrivateTaskComment" ADD CONSTRAINT "PrivateTaskComment_privateTaskId_fkey"
    FOREIGN KEY ("privateTaskId") REFERENCES "PrivateTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

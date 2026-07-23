-- Optional deadline reminder email for private tasks.

ALTER TABLE "PrivateTask" ADD COLUMN "reminderDaysBefore" INTEGER;
ALTER TABLE "PrivateTask" ADD COLUMN "reminderSentAt" TIMESTAMP(3);

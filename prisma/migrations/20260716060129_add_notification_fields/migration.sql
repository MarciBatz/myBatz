-- AlterTable
ALTER TABLE "NotificationLog" ADD COLUMN     "link" TEXT,
ADD COLUMN     "message" TEXT,
ADD COLUMN     "read" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "UserPreferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "notifyTickets" BOOLEAN NOT NULL DEFAULT true,
    "notifyCalendarSzuronap" BOOLEAN NOT NULL DEFAULT true,
    "notifyCalendarHetes" BOOLEAN NOT NULL DEFAULT true,
    "notifyCalendarEgyeb" BOOLEAN NOT NULL DEFAULT true,
    "excludeFromOfficeRotation" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "UserPreferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPermissions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "canRegenerateOfficeSchedule" BOOLEAN NOT NULL DEFAULT false,
    "canManageEmailNotifications" BOOLEAN NOT NULL DEFAULT false,
    "canSendInvites" BOOLEAN NOT NULL DEFAULT false,
    "canDeleteTickets" BOOLEAN NOT NULL DEFAULT false,
    "canManageCategories" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "UserPermissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserPreferences_userId_key" ON "UserPreferences"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPermissions_userId_key" ON "UserPermissions"("userId");

-- AddForeignKey
ALTER TABLE "UserPreferences" ADD CONSTRAINT "UserPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermissions" ADD CONSTRAINT "UserPermissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

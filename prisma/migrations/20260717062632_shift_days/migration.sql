-- CreateTable
CREATE TABLE "ShiftDay" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "timeStart" TEXT,
    "timeEnd" TEXT,
    "location" TEXT,
    "shopName" TEXT,
    "address" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "assignedTo" TEXT,
    "adMode" TEXT,
    "notes" TEXT,
    "shopCode" TEXT,
    "rowIndex" INTEGER NOT NULL,
    "sheetTab" TEXT NOT NULL DEFAULT '2026',
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShiftDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShiftDay_rowIndex_sheetTab_key" ON "ShiftDay"("rowIndex", "sheetTab");

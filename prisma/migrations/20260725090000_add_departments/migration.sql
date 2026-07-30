-- Department-scoped visibility for public tickets.
--
-- Order matters: tables and columns first, then backfill existing rows, and
-- only afterwards the NOT NULL / CHECK constraints — so no existing row is
-- ever momentarily invalid. Nothing is deleted or overwritten.

-- 1. Visibility enum -----------------------------------------------------------
CREATE TYPE "TicketVisibility" AS ENUM ('DEPARTMENT', 'COMPANY_WIDE');

-- 2. Department + membership tables -------------------------------------------
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    -- Lowercased name, written by the application. A stored column rather than
    -- a LOWER("name") expression index: LOWER() only folds accented characters
    -- (é/É) when the database was initialised with a UTF-8 aware collation, and
    -- on a "C" collation database it would silently let "Logisztika" and
    -- "LOGISZTIKA" coexist. This stays correct either way.
    "nameNormalized" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6C5CE7',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- No DB default: @updatedAt is written by Prisma, and every other table in
    -- this schema declares it the same way. A default here would show up as
    -- schema drift and make the next generated migration try to remove it.
    -- The seed INSERT below passes the value explicitly.
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");
CREATE UNIQUE INDEX "Department_nameNormalized_key" ON "Department"("nameNormalized");

CREATE TABLE "UserDepartment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserDepartment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserDepartment_userId_departmentId_key" ON "UserDepartment"("userId", "departmentId");
CREATE INDEX "UserDepartment_departmentId_idx" ON "UserDepartment"("departmentId");

ALTER TABLE "UserDepartment" ADD CONSTRAINT "UserDepartment_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserDepartment" ADD CONSTRAINT "UserDepartment_departmentId_fkey"
    FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. Seed the first department ------------------------------------------------
-- Fixed id so the backfill below is unambiguous and the migration is idempotent
-- in the sense that re-running it would fail loudly on the PK rather than
-- silently creating a second "Egyedi talpbetét".
INSERT INTO "Department" ("id", "name", "nameNormalized", "color", "createdAt", "updatedAt")
VALUES ('dept_egyedi_talpbetet', 'Egyedi talpbetét', 'egyedi talpbetét', '#6C5CE7', NOW(), NOW());

-- 4. Ticket columns (nullable / defaulted first) ------------------------------
ALTER TABLE "Ticket" ADD COLUMN "visibility" "TicketVisibility" NOT NULL DEFAULT 'DEPARTMENT';
ALTER TABLE "Ticket" ADD COLUMN "departmentId" TEXT;

-- 5. Backfill existing tickets into the seeded department ---------------------
UPDATE "Ticket"
SET "departmentId" = 'dept_egyedi_talpbetet'
WHERE "departmentId" IS NULL;

-- 6. Backfill department membership for every currently active user ----------
-- ON CONFLICT keeps this safe if the join row somehow already exists.
-- No email is sent for these rows: the notification is triggered by the
-- application's assignment endpoint, never by SQL.
INSERT INTO "UserDepartment" ("id", "userId", "departmentId", "createdAt")
SELECT 'udep_seed_' || "id", "id", 'dept_egyedi_talpbetet', NOW()
FROM "User"
WHERE "status" = 'ACTIVE'
ON CONFLICT ("userId", "departmentId") DO NOTHING;

-- 7. Constraints — only now that every row is consistent ---------------------
-- RESTRICT, not SET NULL: nulling departmentId while visibility stays
-- 'DEPARTMENT' would violate the CHECK below, so deleting a department that
-- still has tickets fails either way — this way it fails with a clear foreign
-- key error instead of a confusing constraint violation. The schema declares
-- onDelete: Restrict to match, so the two never drift.
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_departmentId_fkey"
    FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Ticket_visibility_departmentId_idx" ON "Ticket"("visibility", "departmentId");
CREATE INDEX "Ticket_departmentId_idx" ON "Ticket"("departmentId");

-- The pairing rule, enforced by the database itself:
--   DEPARTMENT  ⇒ departmentId IS NOT NULL
--   COMPANY_WIDE ⇒ departmentId IS NULL
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_visibility_department_check" CHECK (
    ("visibility" = 'DEPARTMENT'   AND "departmentId" IS NOT NULL) OR
    ("visibility" = 'COMPANY_WIDE' AND "departmentId" IS NULL)
);

-- 8. New per-user permission --------------------------------------------------
ALTER TABLE "UserPermissions" ADD COLUMN "canCreateCompanyWideTasks" BOOLEAN NOT NULL DEFAULT false;

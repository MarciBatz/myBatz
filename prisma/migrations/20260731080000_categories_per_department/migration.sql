-- Categories become per-department.
--
-- Nothing is deleted and no ticket row is touched: every existing category is
-- kept and attached to the seeded "Egyedi talpbetét" department, exactly where
-- the departments migration put every existing ticket. Tickets therefore keep
-- the category they already had, including any company-wide ticket that has
-- one — those simply won't be offered a category from now on.

-- 1. New columns, nullable first so existing rows stay valid ------------------
ALTER TABLE "Category" ADD COLUMN "departmentId" TEXT;
ALTER TABLE "Category" ADD COLUMN "nameNormalized" TEXT;

-- 2. Backfill -----------------------------------------------------------------
-- LOWER() is enough here even though the application uses JS toLowerCase for
-- new rows: this runs once, over names that already exist, and a collation that
-- under-folds can only leave a name *less* normalised than it would be — it
-- cannot merge two distinct names into a false duplicate.
UPDATE "Category" SET "nameNormalized" = LOWER("name") WHERE "nameNormalized" IS NULL;

-- Prefer the department seeded by 20260725090000; fall back to the oldest one
-- if it was renamed away or removed, so the migration doesn't abort on a
-- database whose departments were reorganised.
UPDATE "Category"
SET "departmentId" = COALESCE(
    (SELECT "id" FROM "Department" WHERE "id" = 'dept_egyedi_talpbetet'),
    (SELECT "id" FROM "Department" ORDER BY "createdAt" ASC, "id" ASC LIMIT 1)
)
WHERE "departmentId" IS NULL;

-- 3. Constraints — only now that every row is consistent ----------------------
ALTER TABLE "Category" ALTER COLUMN "departmentId" SET NOT NULL;
ALTER TABLE "Category" ALTER COLUMN "nameNormalized" SET NOT NULL;

-- The name is unique per department now, not globally: two departments may
-- legitimately both have an "Egyéb".
DROP INDEX "Category_name_key";
CREATE UNIQUE INDEX "Category_departmentId_nameNormalized_key" ON "Category"("departmentId", "nameNormalized");
CREATE INDEX "Category_departmentId_idx" ON "Category"("departmentId");

-- Cascade: deleting a department takes its categories with it. Ticket.categoryId
-- is ON DELETE SET NULL, so affected tickets lose the category but survive.
-- (Deleting a department that still has tickets is already blocked by
-- Ticket_departmentId_fkey, so this can only fire for an empty department.)
ALTER TABLE "Category" ADD CONSTRAINT "Category_departmentId_fkey"
    FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

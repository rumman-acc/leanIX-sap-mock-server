-- Add workspace scoping to the meta model + fact sheet graph, so a second workspace is a real,
-- isolated tenant instead of an implicit single global one. Existing rows are backfilled to
-- 'ws-development' (the workspace this mock has always implicitly been) before the column is
-- made required — hand-written instead of prisma-generated because Prisma refuses to
-- auto-generate a required-column-with-no-default migration against tables that already have data.

-- DropIndex
DROP INDEX "fact_sheet_types_technical_key_key";

-- DropIndex
DROP INDEX "relation_types_source_type_id_target_type_id_technical_key_key";

-- DropIndex
DROP INDEX "tag_groups_name_key";

-- AlterTable: add nullable first so existing rows aren't rejected
ALTER TABLE "fact_sheet_types" ADD COLUMN     "workspace_id" TEXT;
ALTER TABLE "fact_sheets" ADD COLUMN     "workspace_id" TEXT;
ALTER TABLE "relation_types" ADD COLUMN     "workspace_id" TEXT;
ALTER TABLE "tag_groups" ADD COLUMN     "workspace_id" TEXT;

-- Backfill: every existing row belongs to the original (only) workspace
UPDATE "fact_sheet_types" SET "workspace_id" = 'ws-development' WHERE "workspace_id" IS NULL;
UPDATE "fact_sheets" SET "workspace_id" = 'ws-development' WHERE "workspace_id" IS NULL;
UPDATE "relation_types" SET "workspace_id" = 'ws-development' WHERE "workspace_id" IS NULL;
UPDATE "tag_groups" SET "workspace_id" = 'ws-development' WHERE "workspace_id" IS NULL;

-- AlterTable: now safe to require
ALTER TABLE "fact_sheet_types" ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "fact_sheets" ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "relation_types" ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "tag_groups" ALTER COLUMN "workspace_id" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "fact_sheet_types_workspace_id_technical_key_key" ON "fact_sheet_types"("workspace_id", "technical_key");

-- CreateIndex
CREATE INDEX "fact_sheets_workspace_id_idx" ON "fact_sheets"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "relation_types_workspace_id_source_type_id_target_type_id_t_key" ON "relation_types"("workspace_id", "source_type_id", "target_type_id", "technical_key");

-- CreateIndex
CREATE UNIQUE INDEX "tag_groups_workspace_id_name_key" ON "tag_groups"("workspace_id", "name");

-- AddForeignKey
ALTER TABLE "fact_sheet_types" ADD CONSTRAINT "fact_sheet_types_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relation_types" ADD CONSTRAINT "relation_types_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_sheets" ADD CONSTRAINT "fact_sheets_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tag_groups" ADD CONSTRAINT "tag_groups_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

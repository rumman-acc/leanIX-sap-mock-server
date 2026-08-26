/*
  Warnings:

  - You are about to drop the column `url` on the `webhooks` table. All the data in the column will be lost.
  - Added the required column `identifier` to the `webhooks` table without a default value. This is not possible if the table is not empty.
  - Added the required column `target_url` to the `webhooks` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "webhooks" DROP COLUMN "url",
ADD COLUMN     "authorization_header" TEXT,
ADD COLUMN     "callback" TEXT,
ADD COLUMN     "delivery_type" TEXT NOT NULL DEFAULT 'PUSH',
ADD COLUMN     "identifier" TEXT NOT NULL,
ADD COLUMN     "ignore_error" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "payload_mode" TEXT NOT NULL DEFAULT 'DEFAULT',
ADD COLUMN     "tag_sets" JSONB,
ADD COLUMN     "target_method" TEXT NOT NULL DEFAULT 'POST',
ADD COLUMN     "target_url" TEXT NOT NULL,
ADD COLUMN     "workspace_constraint" TEXT NOT NULL DEFAULT 'ANY',
ALTER COLUMN "events" SET DEFAULT ARRAY[]::TEXT[];

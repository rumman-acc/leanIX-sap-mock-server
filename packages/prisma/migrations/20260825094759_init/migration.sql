-- CreateTable
CREATE TABLE "fact_sheet_types" (
    "id" TEXT NOT NULL,
    "technical_key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fact_sheet_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attributes" (
    "id" TEXT NOT NULL,
    "technical_key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "data_type" TEXT NOT NULL,
    "fact_sheet_type_id" TEXT NOT NULL,
    "mandatory" BOOLEAN NOT NULL DEFAULT false,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "read_only" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "attributes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allowed_values" (
    "id" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT,
    "attribute_id" TEXT NOT NULL,

    CONSTRAINT "allowed_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relation_types" (
    "id" TEXT NOT NULL,
    "technical_key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "source_type_id" TEXT NOT NULL,
    "target_type_id" TEXT NOT NULL,
    "cardinality" TEXT NOT NULL DEFAULT 'MANY_TO_MANY',
    "mandatory" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "relation_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fact_sheets" (
    "id" TEXT NOT NULL,
    "type_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "external_id" TEXT,
    "display_name" TEXT NOT NULL,
    "lifecycle" JSONB,
    "quality_seal" TEXT NOT NULL DEFAULT 'BROKEN',
    "completion" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "trash_bin" BOOLEAN NOT NULL DEFAULT false,
    "archived_at" TIMESTAMP(3),
    "auto_delete_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,
    "updated_by" TEXT NOT NULL,

    CONSTRAINT "fact_sheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attribute_values" (
    "id" TEXT NOT NULL,
    "fact_sheet_id" TEXT NOT NULL,
    "attribute_id" TEXT NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "attribute_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relations" (
    "id" TEXT NOT NULL,
    "relation_type_id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tag_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,

    CONSTRAINT "tag_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "color" TEXT,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tag_assignments" (
    "id" TEXT NOT NULL,
    "fact_sheet_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,

    CONSTRAINT "tag_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "fact_sheet_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_name" TEXT NOT NULL,
    "user_email" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "roles" TEXT[],

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trash_bin" (
    "id" TEXT NOT NULL,
    "fact_sheet_id" TEXT NOT NULL,
    "fact_sheet_type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "external_id" TEXT,
    "archived_at" TIMESTAMP(3) NOT NULL,
    "auto_delete_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "trash_bin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_configurations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "connector_type" TEXT NOT NULL,
    "connector_id" TEXT NOT NULL,
    "connector_version" TEXT NOT NULL,
    "processing_direction" TEXT NOT NULL,
    "processing_mode" TEXT NOT NULL,
    "processors" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_mappings" (
    "id" TEXT NOT NULL,
    "source_system" TEXT NOT NULL,
    "source_record_id" TEXT NOT NULL,
    "fact_sheet_id" TEXT NOT NULL,
    "fact_sheet_type" TEXT NOT NULL,
    "last_synced_at" TIMESTAMP(3) NOT NULL,
    "sync_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "sync_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_runs" (
    "id" TEXT NOT NULL,
    "connector_type" TEXT NOT NULL,
    "connector_id" TEXT NOT NULL,
    "connector_version" TEXT NOT NULL,
    "processing_direction" TEXT NOT NULL DEFAULT 'inbound',
    "processing_mode" TEXT NOT NULL DEFAULT 'partial',
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "warning_count" INTEGER NOT NULL DEFAULT 0,
    "processed_count" INTEGER NOT NULL DEFAULT 0,
    "created_count" INTEGER NOT NULL DEFAULT 0,
    "updated_count" INTEGER NOT NULL DEFAULT 0,
    "deleted_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_logs" (
    "id" TEXT NOT NULL,
    "sync_run_id" TEXT NOT NULL,
    "fact_sheet_id" TEXT,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "details" JSONB,
    "source_record_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhooks" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "events" TEXT[],
    "secret" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "workspace_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_deliveries" (
    "id" TEXT NOT NULL,
    "webhook_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "response_status" INTEGER,
    "response_body" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "error_message" TEXT,
    "attempt_count" INTEGER NOT NULL DEFAULT 1,
    "next_retry_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "workspace_id" TEXT NOT NULL,
    "api_token" TEXT,
    "api_token_secret" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fact_sheet_types_technical_key_key" ON "fact_sheet_types"("technical_key");

-- CreateIndex
CREATE UNIQUE INDEX "attributes_fact_sheet_type_id_technical_key_key" ON "attributes"("fact_sheet_type_id", "technical_key");

-- CreateIndex
CREATE UNIQUE INDEX "relation_types_source_type_id_target_type_id_technical_key_key" ON "relation_types"("source_type_id", "target_type_id", "technical_key");

-- CreateIndex
CREATE INDEX "fact_sheets_type_id_idx" ON "fact_sheets"("type_id");

-- CreateIndex
CREATE INDEX "fact_sheets_external_id_idx" ON "fact_sheets"("external_id");

-- CreateIndex
CREATE INDEX "fact_sheets_status_idx" ON "fact_sheets"("status");

-- CreateIndex
CREATE INDEX "fact_sheets_trash_bin_idx" ON "fact_sheets"("trash_bin");

-- CreateIndex
CREATE UNIQUE INDEX "attribute_values_fact_sheet_id_attribute_id_key" ON "attribute_values"("fact_sheet_id", "attribute_id");

-- CreateIndex
CREATE UNIQUE INDEX "relations_relation_type_id_source_id_target_id_key" ON "relations"("relation_type_id", "source_id", "target_id");

-- CreateIndex
CREATE UNIQUE INDEX "tag_groups_name_key" ON "tag_groups"("name");

-- CreateIndex
CREATE UNIQUE INDEX "tags_group_id_name_key" ON "tags"("group_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "tag_assignments_fact_sheet_id_tag_id_key" ON "tag_assignments"("fact_sheet_id", "tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_fact_sheet_id_user_id_type_key" ON "subscriptions"("fact_sheet_id", "user_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "trash_bin_fact_sheet_id_key" ON "trash_bin"("fact_sheet_id");

-- CreateIndex
CREATE INDEX "trash_bin_auto_delete_at_idx" ON "trash_bin"("auto_delete_at");

-- CreateIndex
CREATE UNIQUE INDEX "integration_configurations_connector_id_connector_type_key" ON "integration_configurations"("connector_id", "connector_type");

-- CreateIndex
CREATE INDEX "sync_mappings_fact_sheet_id_idx" ON "sync_mappings"("fact_sheet_id");

-- CreateIndex
CREATE UNIQUE INDEX "sync_mappings_source_system_source_record_id_key" ON "sync_mappings"("source_system", "source_record_id");

-- CreateIndex
CREATE INDEX "sync_logs_sync_run_id_idx" ON "sync_logs"("sync_run_id");

-- CreateIndex
CREATE INDEX "sync_logs_level_idx" ON "sync_logs"("level");

-- CreateIndex
CREATE INDEX "webhook_deliveries_webhook_id_idx" ON "webhook_deliveries"("webhook_id");

-- CreateIndex
CREATE INDEX "webhook_deliveries_success_idx" ON "webhook_deliveries"("success");

-- CreateIndex
CREATE INDEX "webhook_deliveries_next_retry_at_idx" ON "webhook_deliveries"("next_retry_at");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_api_token_key" ON "users"("api_token");

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_name_key" ON "workspaces"("name");

-- AddForeignKey
ALTER TABLE "attributes" ADD CONSTRAINT "attributes_fact_sheet_type_id_fkey" FOREIGN KEY ("fact_sheet_type_id") REFERENCES "fact_sheet_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allowed_values" ADD CONSTRAINT "allowed_values_attribute_id_fkey" FOREIGN KEY ("attribute_id") REFERENCES "attributes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relation_types" ADD CONSTRAINT "relation_types_source_type_id_fkey" FOREIGN KEY ("source_type_id") REFERENCES "fact_sheet_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relation_types" ADD CONSTRAINT "relation_types_target_type_id_fkey" FOREIGN KEY ("target_type_id") REFERENCES "fact_sheet_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_sheets" ADD CONSTRAINT "fact_sheets_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "fact_sheet_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attribute_values" ADD CONSTRAINT "attribute_values_fact_sheet_id_fkey" FOREIGN KEY ("fact_sheet_id") REFERENCES "fact_sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attribute_values" ADD CONSTRAINT "attribute_values_attribute_id_fkey" FOREIGN KEY ("attribute_id") REFERENCES "attributes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relations" ADD CONSTRAINT "relations_relation_type_id_fkey" FOREIGN KEY ("relation_type_id") REFERENCES "relation_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relations" ADD CONSTRAINT "relations_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "fact_sheets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relations" ADD CONSTRAINT "relations_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "fact_sheets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "tag_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tag_assignments" ADD CONSTRAINT "tag_assignments_fact_sheet_id_fkey" FOREIGN KEY ("fact_sheet_id") REFERENCES "fact_sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tag_assignments" ADD CONSTRAINT "tag_assignments_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_fact_sheet_id_fkey" FOREIGN KEY ("fact_sheet_id") REFERENCES "fact_sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_mappings" ADD CONSTRAINT "sync_mappings_fact_sheet_id_fkey" FOREIGN KEY ("fact_sheet_id") REFERENCES "fact_sheets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_sync_run_id_fkey" FOREIGN KEY ("sync_run_id") REFERENCES "sync_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_fact_sheet_id_fkey" FOREIGN KEY ("fact_sheet_id") REFERENCES "fact_sheets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_id_fkey" FOREIGN KEY ("webhook_id") REFERENCES "webhooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

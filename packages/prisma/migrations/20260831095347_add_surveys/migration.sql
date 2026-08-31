-- CreateTable
CREATE TABLE "survey_definitions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "fact_sheet_type" TEXT,
    "questions" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "survey_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_runs" (
    "id" TEXT NOT NULL,
    "definition_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "survey_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_invitations" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "fact_sheet_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "invited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "survey_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_responses" (
    "id" TEXT NOT NULL,
    "invitation_id" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "survey_responses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "survey_runs_definition_id_idx" ON "survey_runs"("definition_id");

-- CreateIndex
CREATE INDEX "survey_invitations_run_id_idx" ON "survey_invitations"("run_id");

-- CreateIndex
CREATE UNIQUE INDEX "survey_responses_invitation_id_key" ON "survey_responses"("invitation_id");

-- AddForeignKey
ALTER TABLE "survey_runs" ADD CONSTRAINT "survey_runs_definition_id_fkey" FOREIGN KEY ("definition_id") REFERENCES "survey_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_invitations" ADD CONSTRAINT "survey_invitations_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "survey_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_invitations" ADD CONSTRAINT "survey_invitations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_invitation_id_fkey" FOREIGN KEY ("invitation_id") REFERENCES "survey_invitations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

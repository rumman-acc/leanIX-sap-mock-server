-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "fact_sheet_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "todos" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "fact_sheet_id" TEXT,
    "assignee_id" TEXT,
    "due_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "todos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "comments_fact_sheet_id_idx" ON "comments"("fact_sheet_id");

-- CreateIndex
CREATE INDEX "todos_fact_sheet_id_idx" ON "todos"("fact_sheet_id");

-- CreateIndex
CREATE INDEX "todos_assignee_id_idx" ON "todos"("assignee_id");

-- CreateIndex
CREATE INDEX "todos_status_idx" ON "todos"("status");

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_fact_sheet_id_fkey" FOREIGN KEY ("fact_sheet_id") REFERENCES "fact_sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "todos" ADD CONSTRAINT "todos_fact_sheet_id_fkey" FOREIGN KEY ("fact_sheet_id") REFERENCES "fact_sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "todos" ADD CONSTRAINT "todos_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

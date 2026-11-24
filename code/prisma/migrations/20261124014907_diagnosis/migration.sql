-- CreateEnum
CREATE TYPE "RuleSetStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'RETIRED');

-- CreateTable
CREATE TABLE "diagnosis_rule_sets" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "RuleSetStatus" NOT NULL DEFAULT 'DRAFT',
    "definition" JSONB NOT NULL,
    "note" TEXT,
    "created_by" TEXT,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diagnosis_rule_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnoses" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "rule_version" INTEGER NOT NULL,
    "answers" JSONB NOT NULL,
    "signals" JSONB NOT NULL,
    "interpretation" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "customer_id" TEXT,
    "email" TEXT,
    "emailed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diagnoses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "diagnosis_rule_sets_version_key" ON "diagnosis_rule_sets"("version");

-- CreateIndex
CREATE UNIQUE INDEX "diagnoses_code_key" ON "diagnoses"("code");

-- CreateIndex
CREATE INDEX "diagnoses_customer_id_created_at_idx" ON "diagnoses"("customer_id", "created_at");

-- AddForeignKey
ALTER TABLE "diagnoses" ADD CONSTRAINT "diagnoses_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

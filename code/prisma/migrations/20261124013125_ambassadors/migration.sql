-- CreateEnum
CREATE TYPE "AmbassadorStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'LEFT');

-- CreateEnum
CREATE TYPE "AttributionSource" AS ENUM ('CODE', 'CART', 'COOKIE', 'ACCOUNT');

-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID', 'CANCELLED');

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "referred_at" TIMESTAMP(3),
ADD COLUMN     "referred_by_id" TEXT;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "ambassador_id" TEXT,
ADD COLUMN     "attribution_source" "AttributionSource";

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "commission_pct" DECIMAL(5,2);

-- CreateTable
CREATE TABLE "ambassadors" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT,
    "status" "AmbassadorStatus" NOT NULL DEFAULT 'PENDING',
    "code" TEXT,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "profession" TEXT NOT NULL,
    "license" TEXT,
    "license_file" TEXT,
    "city" TEXT NOT NULL,
    "workplaces" TEXT[],
    "social" TEXT,
    "motivation" TEXT NOT NULL,
    "privacy_version" INTEGER,
    "commission_pct" DECIMAL(5,2),
    "customer_discount_pct" INTEGER,
    "cuit" TEXT,
    "payout_account" TEXT,
    "note" TEXT,
    "reject_reason" TEXT,
    "approved_at" TIMESTAMP(3),
    "left_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ambassadors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_visits" (
    "id" TEXT NOT NULL,
    "ambassador_id" TEXT NOT NULL,
    "visitor" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attributions" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "ambassador_id" TEXT NOT NULL,
    "source" "AttributionSource" NOT NULL,
    "code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commissions" (
    "id" TEXT NOT NULL,
    "ambassador_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "status" "CommissionStatus" NOT NULL DEFAULT 'PENDING',
    "base_cents" INTEGER NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "lines" JSONB NOT NULL,
    "without_vat" BOOLEAN NOT NULL,
    "approved_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancel_reason" TEXT,
    "payout_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_adjustments" (
    "id" TEXT NOT NULL,
    "ambassador_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "payout_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_payouts" (
    "id" TEXT NOT NULL,
    "ambassador_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "invoice_number" TEXT,
    "paid_at" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ambassador_materials" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "url" TEXT,
    "file_key" TEXT,
    "file_name" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ambassador_materials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ambassadors_customer_id_key" ON "ambassadors"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "ambassadors_code_key" ON "ambassadors"("code");

-- CreateIndex
CREATE INDEX "ambassadors_status_idx" ON "ambassadors"("status");

-- CreateIndex
CREATE INDEX "referral_visits_ambassador_id_created_at_idx" ON "referral_visits"("ambassador_id", "created_at");

-- CreateIndex
CREATE INDEX "referral_visits_visitor_created_at_idx" ON "referral_visits"("visitor", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "attributions_order_id_key" ON "attributions"("order_id");

-- CreateIndex
CREATE INDEX "attributions_ambassador_id_idx" ON "attributions"("ambassador_id");

-- CreateIndex
CREATE UNIQUE INDEX "commissions_order_id_key" ON "commissions"("order_id");

-- CreateIndex
CREATE INDEX "commissions_ambassador_id_status_idx" ON "commissions"("ambassador_id", "status");

-- CreateIndex
CREATE INDEX "commissions_status_idx" ON "commissions"("status");

-- CreateIndex
CREATE INDEX "commission_adjustments_ambassador_id_payout_id_idx" ON "commission_adjustments"("ambassador_id", "payout_id");

-- CreateIndex
CREATE UNIQUE INDEX "commission_payouts_ambassador_id_period_key" ON "commission_payouts"("ambassador_id", "period");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_referred_by_id_fkey" FOREIGN KEY ("referred_by_id") REFERENCES "ambassadors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_ambassador_id_fkey" FOREIGN KEY ("ambassador_id") REFERENCES "ambassadors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ambassadors" ADD CONSTRAINT "ambassadors_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_visits" ADD CONSTRAINT "referral_visits_ambassador_id_fkey" FOREIGN KEY ("ambassador_id") REFERENCES "ambassadors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attributions" ADD CONSTRAINT "attributions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attributions" ADD CONSTRAINT "attributions_ambassador_id_fkey" FOREIGN KEY ("ambassador_id") REFERENCES "ambassadors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_ambassador_id_fkey" FOREIGN KEY ("ambassador_id") REFERENCES "ambassadors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "commission_payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_adjustments" ADD CONSTRAINT "commission_adjustments_ambassador_id_fkey" FOREIGN KEY ("ambassador_id") REFERENCES "ambassadors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_adjustments" ADD CONSTRAINT "commission_adjustments_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "commission_payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_payouts" ADD CONSTRAINT "commission_payouts_ambassador_id_fkey" FOREIGN KEY ("ambassador_id") REFERENCES "ambassadors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

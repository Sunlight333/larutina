-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PRESALE', 'SOLD_OUT', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "Aptitude" AS ENUM ('IDEAL', 'SUITABLE', 'CAUTION', 'NOT_RECOMMENDED');

-- CreateEnum
CREATE TYPE "Moment" AS ENUM ('AM', 'PM', 'BOTH');

-- CreateEnum
CREATE TYPE "RoutineStepType" AS ENUM ('MAKEUP_REMOVER', 'CLEANSER', 'EXFOLIANT', 'TONER', 'ESSENCE', 'SERUM', 'EYE_CONTOUR', 'MOISTURIZER', 'OIL', 'SUNSCREEN', 'MASK', 'TREATMENT');

-- CreateEnum
CREATE TYPE "Unit" AS ENUM ('ML', 'G', 'UNITS');

-- CreateEnum
CREATE TYPE "ConflictSeverity" AS ENUM ('AVOID', 'CAUTION', 'ALTERNATE_DAYS');

-- CreateEnum
CREATE TYPE "RoutineDifficulty" AS ENUM ('BASIC', 'INTERMEDIATE', 'COMPLETE');

-- CreateEnum
CREATE TYPE "ExperienceLevel" AS ENUM ('BASIC', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('PRODUCT', 'KIT', 'TRAVEL_SIZE');

-- CreateEnum
CREATE TYPE "SealValue" AS ENUM ('YES', 'NO', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ProductLabel" AS ENUM ('NEW', 'LIMITED_EDITION', 'DERMATOLOGIST_RECOMMENDED');

-- CreateEnum
CREATE TYPE "ProductRelationKind" AS ENUM ('COMPATIBLE', 'COMPLEMENTARY', 'ALTERNATIVE');

-- CreateEnum
CREATE TYPE "IngredientStatus" AS ENUM ('ACTIVE', 'REVIEW');

-- CreateEnum
CREATE TYPE "RoutineStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "SynonymType" AS ENUM ('SKIN_TYPE', 'CONCERN', 'PRODUCT_TYPE', 'BRAND', 'INGREDIENT', 'INTENT');

-- CreateEnum
CREATE TYPE "KnowledgeCategory" AS ENUM ('SHIPPING', 'PAYMENTS', 'RETURNS', 'PRODUCT_USE', 'ROUTINES', 'AMBASSADORS', 'GENERAL');

-- CreateEnum
CREATE TYPE "EndorsementTarget" AS ENUM ('PRODUCT', 'ROUTINE');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('REJECTED', 'VALIDATED', 'APPLIED');

-- CreateTable
CREATE TABLE "brands" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country_of_origin" TEXT,
    "description" TEXT,
    "logo_file" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" TEXT,
    "sort_order" INTEGER,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concerns" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "short_label" TEXT NOT NULL,
    "short_description" TEXT,
    "editorial_content" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "concerns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skin_types" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "skin_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredient_families" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "warning" TEXT,
    "excludable_in_diagnosis" BOOLEAN NOT NULL DEFAULT false,
    "no_duplicate" BOOLEAN NOT NULL DEFAULT false,
    "computes" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ingredient_families_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredients" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "common_name" TEXT NOT NULL,
    "inci_name" TEXT NOT NULL,
    "inci_key" TEXT NOT NULL,
    "is_key_active" BOOLEAN NOT NULL DEFAULT false,
    "is_irritant" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "family_id" TEXT,
    "status" "IngredientStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredient_concerns" (
    "ingredient_id" TEXT NOT NULL,
    "concern_id" TEXT NOT NULL,

    CONSTRAINT "ingredient_concerns_pkey" PRIMARY KEY ("ingredient_id","concern_id")
);

-- CreateTable
CREATE TABLE "ingredient_conflicts" (
    "id" TEXT NOT NULL,
    "ingredient_a_id" TEXT NOT NULL,
    "ingredient_b_id" TEXT NOT NULL,
    "severity" "ConflictSeverity" NOT NULL,
    "note" TEXT,

    CONSTRAINT "ingredient_conflicts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_conflicts" (
    "id" TEXT NOT NULL,
    "family_a_id" TEXT NOT NULL,
    "family_b_id" TEXT NOT NULL,
    "severity" "ConflictSeverity" NOT NULL,
    "note" TEXT,

    CONSTRAINT "family_conflicts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
    "type" "ProductType" NOT NULL DEFAULT 'PRODUCT',
    "short_description" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "benefits" TEXT[],
    "why_we_chose" TEXT NOT NULL,
    "evaluation_score" INTEGER,
    "evaluation_notes" TEXT,
    "how_to_use" TEXT NOT NULL,
    "precautions" TEXT,
    "texture" TEXT NOT NULL,
    "texture_description" TEXT,
    "tips" TEXT,
    "routine_step" "RoutineStepType" NOT NULL,
    "moment" "Moment" NOT NULL,
    "duration_days" INTEGER,
    "level" "ExperienceLevel",
    "priority" INTEGER,
    "base_product_id" TEXT,
    "kit_contents" TEXT[],
    "line" TEXT,
    "headline" TEXT,
    "chips" TEXT[],
    "labels" "ProductLabel"[],
    "vegan" "SealValue" NOT NULL DEFAULT 'UNKNOWN',
    "cruelty_free" "SealValue" NOT NULL DEFAULT 'UNKNOWN',
    "dermatologist_tested" "SealValue" NOT NULL DEFAULT 'UNKNOWN',
    "seal_source" TEXT,
    "anmat_registration" TEXT,
    "importer_holder" TEXT,
    "country_of_origin" TEXT,
    "pao_months" INTEGER,
    "vat_rate" DECIMAL(5,2),
    "inci_text" TEXT,
    "images" TEXT[],
    "video_url" TEXT,
    "seo_title" TEXT,
    "seo_description" TEXT,
    "fragrance_free" BOOLEAN NOT NULL DEFAULT true,
    "fragrance_free_declared" BOOLEAN,
    "essential_oil_free" BOOLEAN NOT NULL DEFAULT true,
    "contains_retinoid" BOOLEAN NOT NULL DEFAULT false,
    "contains_exfoliating_acid" BOOLEAN NOT NULL DEFAULT false,
    "alcohol_free" BOOLEAN NOT NULL DEFAULT true,
    "paraben_free" BOOLEAN NOT NULL DEFAULT true,
    "silicone_free" BOOLEAN NOT NULL DEFAULT true,
    "sulfate_free" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "size" DECIMAL(10,2) NOT NULL,
    "unit" "Unit" NOT NULL,
    "price_cents" INTEGER NOT NULL,
    "promo_price_cents" INTEGER,
    "stock" INTEGER NOT NULL,
    "barcode" TEXT,
    "weight_grams" INTEGER,
    "is_main" BOOLEAN NOT NULL DEFAULT false,
    "duration_days" INTEGER,
    "height_cm" DECIMAL(6,1),
    "width_cm" DECIMAL(6,1),
    "length_cm" DECIMAL(6,1),
    "cost_cents" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_ingredients" (
    "product_id" TEXT NOT NULL,
    "ingredient_id" TEXT NOT NULL,
    "inci_order" INTEGER NOT NULL,
    "is_star" BOOLEAN NOT NULL DEFAULT false,
    "concentration" TEXT,

    CONSTRAINT "product_ingredients_pkey" PRIMARY KEY ("product_id","ingredient_id")
);

-- CreateTable
CREATE TABLE "product_concerns" (
    "product_id" TEXT NOT NULL,
    "concern_id" TEXT NOT NULL,
    "relevance" INTEGER NOT NULL,

    CONSTRAINT "product_concerns_pkey" PRIMARY KEY ("product_id","concern_id")
);

-- CreateTable
CREATE TABLE "product_skin_types" (
    "product_id" TEXT NOT NULL,
    "skin_type_id" TEXT NOT NULL,
    "aptitude" "Aptitude" NOT NULL,

    CONSTRAINT "product_skin_types_pkey" PRIMARY KEY ("product_id","skin_type_id")
);

-- CreateTable
CREATE TABLE "product_relations" (
    "product_id" TEXT NOT NULL,
    "related_id" TEXT NOT NULL,
    "kind" "ProductRelationKind" NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "product_relations_pkey" PRIMARY KEY ("product_id","related_id","kind")
);

-- CreateTable
CREATE TABLE "evaluation_criteria" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weight" DECIMAL(8,2) NOT NULL,
    "description" TEXT,

    CONSTRAINT "evaluation_criteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_evaluations" (
    "product_id" TEXT NOT NULL,
    "criterion_id" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "note" TEXT,

    CONSTRAINT "product_evaluations_pkey" PRIMARY KEY ("product_id","criterion_id")
);

-- CreateTable
CREATE TABLE "endorsements" (
    "id" TEXT NOT NULL,
    "target_type" "EndorsementTarget" NOT NULL,
    "target_code" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "detail" TEXT,
    "quote" TEXT,
    "image" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "endorsements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routines" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "moment" "Moment" NOT NULL,
    "difficulty" "RoutineDifficulty",
    "discount_pct" INTEGER,
    "description" TEXT,
    "status" "RoutineStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "routines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routine_skin_types" (
    "routine_id" TEXT NOT NULL,
    "skin_type_id" TEXT NOT NULL,

    CONSTRAINT "routine_skin_types_pkey" PRIMARY KEY ("routine_id","skin_type_id")
);

-- CreateTable
CREATE TABLE "routine_concerns" (
    "routine_id" TEXT NOT NULL,
    "concern_id" TEXT NOT NULL,

    CONSTRAINT "routine_concerns_pkey" PRIMARY KEY ("routine_id","concern_id")
);

-- CreateTable
CREATE TABLE "routine_steps" (
    "id" TEXT NOT NULL,
    "routine_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "moment" "Moment" NOT NULL,
    "step_type" "RoutineStepType" NOT NULL,
    "title" TEXT NOT NULL,
    "main_product_id" TEXT NOT NULL,
    "instruction" TEXT,
    "frequency" TEXT,
    "optional" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "routine_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routine_step_alternatives" (
    "step_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "routine_step_alternatives_pkey" PRIMARY KEY ("step_id","product_id")
);

-- CreateTable
CREATE TABLE "synonyms" (
    "id" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "type" "SynonymType" NOT NULL,
    "target_code" TEXT NOT NULL,
    "variants" TEXT[],

    CONSTRAINT "synonyms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_entries" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "category" "KnowledgeCategory" NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "keywords" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_jobs" (
    "id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "status" "ImportStatus" NOT NULL,
    "stage" TEXT NOT NULL,
    "summary" JSONB NOT NULL,
    "issues" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "brands_code_key" ON "brands"("code");

-- CreateIndex
CREATE UNIQUE INDEX "categories_code_key" ON "categories"("code");

-- CreateIndex
CREATE INDEX "categories_parent_id_idx" ON "categories"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "concerns_code_key" ON "concerns"("code");

-- CreateIndex
CREATE UNIQUE INDEX "skin_types_code_key" ON "skin_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ingredient_families_code_key" ON "ingredient_families"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ingredients_code_key" ON "ingredients"("code");

-- CreateIndex
CREATE INDEX "ingredients_inci_key_idx" ON "ingredients"("inci_key");

-- CreateIndex
CREATE INDEX "ingredients_family_id_idx" ON "ingredients"("family_id");

-- CreateIndex
CREATE UNIQUE INDEX "ingredient_conflicts_ingredient_a_id_ingredient_b_id_key" ON "ingredient_conflicts"("ingredient_a_id", "ingredient_b_id");

-- CreateIndex
CREATE UNIQUE INDEX "family_conflicts_family_a_id_family_b_id_key" ON "family_conflicts"("family_a_id", "family_b_id");

-- CreateIndex
CREATE UNIQUE INDEX "products_code_key" ON "products"("code");

-- CreateIndex
CREATE INDEX "products_brand_id_idx" ON "products"("brand_id");

-- CreateIndex
CREATE INDEX "products_category_id_idx" ON "products"("category_id");

-- CreateIndex
CREATE INDEX "products_status_idx" ON "products"("status");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_sku_key" ON "product_variants"("sku");

-- CreateIndex
CREATE INDEX "product_variants_product_id_idx" ON "product_variants"("product_id");

-- CreateIndex
CREATE INDEX "product_ingredients_ingredient_id_idx" ON "product_ingredients"("ingredient_id");

-- CreateIndex
CREATE INDEX "product_concerns_concern_id_relevance_idx" ON "product_concerns"("concern_id", "relevance");

-- CreateIndex
CREATE INDEX "product_skin_types_skin_type_id_idx" ON "product_skin_types"("skin_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_criteria_code_key" ON "evaluation_criteria"("code");

-- CreateIndex
CREATE INDEX "endorsements_target_type_target_code_idx" ON "endorsements"("target_type", "target_code");

-- CreateIndex
CREATE UNIQUE INDEX "routines_code_key" ON "routines"("code");

-- CreateIndex
CREATE UNIQUE INDEX "routine_steps_routine_id_position_key" ON "routine_steps"("routine_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "synonyms_type_target_code_term_key" ON "synonyms"("type", "target_code", "term");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_entries_code_key" ON "knowledge_entries"("code");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "ingredient_families"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredient_concerns" ADD CONSTRAINT "ingredient_concerns_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredient_concerns" ADD CONSTRAINT "ingredient_concerns_concern_id_fkey" FOREIGN KEY ("concern_id") REFERENCES "concerns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredient_conflicts" ADD CONSTRAINT "ingredient_conflicts_ingredient_a_id_fkey" FOREIGN KEY ("ingredient_a_id") REFERENCES "ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredient_conflicts" ADD CONSTRAINT "ingredient_conflicts_ingredient_b_id_fkey" FOREIGN KEY ("ingredient_b_id") REFERENCES "ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_conflicts" ADD CONSTRAINT "family_conflicts_family_a_id_fkey" FOREIGN KEY ("family_a_id") REFERENCES "ingredient_families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_conflicts" ADD CONSTRAINT "family_conflicts_family_b_id_fkey" FOREIGN KEY ("family_b_id") REFERENCES "ingredient_families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_base_product_id_fkey" FOREIGN KEY ("base_product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_ingredients" ADD CONSTRAINT "product_ingredients_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_ingredients" ADD CONSTRAINT "product_ingredients_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_concerns" ADD CONSTRAINT "product_concerns_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_concerns" ADD CONSTRAINT "product_concerns_concern_id_fkey" FOREIGN KEY ("concern_id") REFERENCES "concerns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_skin_types" ADD CONSTRAINT "product_skin_types_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_skin_types" ADD CONSTRAINT "product_skin_types_skin_type_id_fkey" FOREIGN KEY ("skin_type_id") REFERENCES "skin_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_relations" ADD CONSTRAINT "product_relations_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_relations" ADD CONSTRAINT "product_relations_related_id_fkey" FOREIGN KEY ("related_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_evaluations" ADD CONSTRAINT "product_evaluations_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_evaluations" ADD CONSTRAINT "product_evaluations_criterion_id_fkey" FOREIGN KEY ("criterion_id") REFERENCES "evaluation_criteria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_skin_types" ADD CONSTRAINT "routine_skin_types_routine_id_fkey" FOREIGN KEY ("routine_id") REFERENCES "routines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_skin_types" ADD CONSTRAINT "routine_skin_types_skin_type_id_fkey" FOREIGN KEY ("skin_type_id") REFERENCES "skin_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_concerns" ADD CONSTRAINT "routine_concerns_routine_id_fkey" FOREIGN KEY ("routine_id") REFERENCES "routines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_concerns" ADD CONSTRAINT "routine_concerns_concern_id_fkey" FOREIGN KEY ("concern_id") REFERENCES "concerns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_steps" ADD CONSTRAINT "routine_steps_routine_id_fkey" FOREIGN KEY ("routine_id") REFERENCES "routines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_steps" ADD CONSTRAINT "routine_steps_main_product_id_fkey" FOREIGN KEY ("main_product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_step_alternatives" ADD CONSTRAINT "routine_step_alternatives_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "routine_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_step_alternatives" ADD CONSTRAINT "routine_step_alternatives_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

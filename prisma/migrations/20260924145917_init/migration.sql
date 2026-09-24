-- CreateTable
CREATE TABLE "brands" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skin_types" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "skin_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concerns" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "short_label" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "concerns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredients" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "inci_name" TEXT NOT NULL,
    "common_name" TEXT NOT NULL,
    "description" TEXT,
    "is_key_active" BOOLEAN NOT NULL DEFAULT false,
    "is_irritant" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredient_conflicts" (
    "id" TEXT NOT NULL,
    "ingredient_a_id" TEXT NOT NULL,
    "ingredient_b_id" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "note" TEXT NOT NULL,

    CONSTRAINT "ingredient_conflicts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "short_description" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "why_we_chose" TEXT NOT NULL,
    "our_rating" INTEGER NOT NULL,
    "rating_notes" TEXT NOT NULL,
    "how_to_use" TEXT NOT NULL,
    "precautions" TEXT,
    "texture" TEXT NOT NULL,
    "fragrance_free" BOOLEAN NOT NULL DEFAULT true,
    "routine_step_type" TEXT NOT NULL,
    "routine_moment" TEXT NOT NULL,
    "size_label" TEXT NOT NULL,
    "price_cents" INTEGER NOT NULL,
    "color" TEXT NOT NULL,
    "avg_rating" DOUBLE PRECISION NOT NULL,
    "review_count" INTEGER NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_skin_types" (
    "product_id" TEXT NOT NULL,
    "skin_type_id" TEXT NOT NULL,
    "suitability" TEXT NOT NULL,

    CONSTRAINT "product_skin_types_pkey" PRIMARY KEY ("product_id","skin_type_id")
);

-- CreateTable
CREATE TABLE "product_concerns" (
    "product_id" TEXT NOT NULL,
    "concern_id" TEXT NOT NULL,
    "relevance" INTEGER NOT NULL,

    CONSTRAINT "product_concerns_pkey" PRIMARY KEY ("product_id","concern_id")
);

-- CreateTable
CREATE TABLE "product_ingredients" (
    "product_id" TEXT NOT NULL,
    "ingredient_id" TEXT NOT NULL,
    "is_key_active" BOOLEAN NOT NULL DEFAULT false,
    "concentration" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "product_ingredients_pkey" PRIMARY KEY ("product_id","ingredient_id")
);

-- CreateTable
CREATE TABLE "diagnoses" (
    "id" TEXT NOT NULL,
    "rule_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diagnoses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnosis_answers" (
    "id" TEXT NOT NULL,
    "diagnosis_id" TEXT NOT NULL,
    "question_key" TEXT NOT NULL,
    "values" TEXT[],

    CONSTRAINT "diagnosis_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnosis_results" (
    "id" TEXT NOT NULL,
    "diagnosis_id" TEXT NOT NULL,
    "skin_type_slug" TEXT NOT NULL,
    "concern_scores" JSONB NOT NULL,
    "attributes" JSONB NOT NULL,
    "routine" JSONB NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diagnosis_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "brands_slug_key" ON "brands"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "skin_types_slug_key" ON "skin_types"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "concerns_slug_key" ON "concerns"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ingredients_slug_key" ON "ingredients"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ingredient_conflicts_ingredient_a_id_ingredient_b_id_key" ON "ingredient_conflicts"("ingredient_a_id", "ingredient_b_id");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE INDEX "products_brand_id_idx" ON "products"("brand_id");

-- CreateIndex
CREATE INDEX "product_skin_types_skin_type_id_idx" ON "product_skin_types"("skin_type_id");

-- CreateIndex
CREATE INDEX "product_concerns_concern_id_relevance_idx" ON "product_concerns"("concern_id", "relevance");

-- CreateIndex
CREATE INDEX "product_ingredients_ingredient_id_idx" ON "product_ingredients"("ingredient_id");

-- CreateIndex
CREATE UNIQUE INDEX "diagnosis_answers_diagnosis_id_question_key_key" ON "diagnosis_answers"("diagnosis_id", "question_key");

-- CreateIndex
CREATE UNIQUE INDEX "diagnosis_results_diagnosis_id_key" ON "diagnosis_results"("diagnosis_id");

-- AddForeignKey
ALTER TABLE "ingredient_conflicts" ADD CONSTRAINT "ingredient_conflicts_ingredient_a_id_fkey" FOREIGN KEY ("ingredient_a_id") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredient_conflicts" ADD CONSTRAINT "ingredient_conflicts_ingredient_b_id_fkey" FOREIGN KEY ("ingredient_b_id") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_skin_types" ADD CONSTRAINT "product_skin_types_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_skin_types" ADD CONSTRAINT "product_skin_types_skin_type_id_fkey" FOREIGN KEY ("skin_type_id") REFERENCES "skin_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_concerns" ADD CONSTRAINT "product_concerns_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_concerns" ADD CONSTRAINT "product_concerns_concern_id_fkey" FOREIGN KEY ("concern_id") REFERENCES "concerns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_ingredients" ADD CONSTRAINT "product_ingredients_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_ingredients" ADD CONSTRAINT "product_ingredients_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnosis_answers" ADD CONSTRAINT "diagnosis_answers_diagnosis_id_fkey" FOREIGN KEY ("diagnosis_id") REFERENCES "diagnoses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnosis_results" ADD CONSTRAINT "diagnosis_results_diagnosis_id_fkey" FOREIGN KEY ("diagnosis_id") REFERENCES "diagnoses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

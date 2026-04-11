-- CreateEnum
CREATE TYPE "CarTaxonomyMatchType" AS ENUM ('CLASS_AND_LABEL', 'CLASS_NAME', 'RACE_LABEL', 'SECTION_HEADER', 'SESSION_TYPE');

-- CreateTable
CREATE TABLE "car_taxonomy_nodes" (
    "id" TEXT NOT NULL,
    "parent_id" TEXT,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "car_taxonomy_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_car_taxonomy_rules" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "match_type" "CarTaxonomyMatchType" NOT NULL,
    "pattern_normalized" TEXT NOT NULL,
    "taxonomy_node_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "user_car_taxonomy_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "car_taxonomy_nodes_slug_key" ON "car_taxonomy_nodes"("slug");

-- CreateIndex
CREATE INDEX "car_taxonomy_nodes_parent_id_idx" ON "car_taxonomy_nodes"("parent_id");

-- CreateIndex
CREATE INDEX "user_car_taxonomy_rules_user_id_idx" ON "user_car_taxonomy_rules"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_car_taxonomy_rules_user_id_match_type_pattern_normalized_key" ON "user_car_taxonomy_rules"("user_id", "match_type", "pattern_normalized");

-- AddForeignKey
ALTER TABLE "car_taxonomy_nodes" ADD CONSTRAINT "car_taxonomy_nodes_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "car_taxonomy_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_car_taxonomy_rules" ADD CONSTRAINT "user_car_taxonomy_rules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_car_taxonomy_rules" ADD CONSTRAINT "user_car_taxonomy_rules_taxonomy_node_id_fkey" FOREIGN KEY ("taxonomy_node_id") REFERENCES "car_taxonomy_nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed taxonomy (fixed UUIDs for stable references)
INSERT INTO "car_taxonomy_nodes" ("id", "parent_id", "slug", "label", "sort_order") VALUES
  ('c1000000-0000-4000-8000-000000000001', NULL, 'off-road', 'Off-Road', 0),
  ('c1000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000001', 'off-road-1-8', '1/8', 0),
  ('c1000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000002', 'off-road-1-8-electric-buggy', '1/8 Electric Buggy', 0),
  ('c1000000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000002', 'off-road-1-8-nitro-buggy', '1/8 Nitro Buggy', 1),
  ('c1000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000001', 'off-road-1-10', '1/10', 1),
  ('c1000000-0000-4000-8000-000000000006', 'c1000000-0000-4000-8000-000000000005', 'off-road-1-10-electric-buggy', '1/10 Electric Buggy', 0),
  ('c1000000-0000-4000-8000-000000000007', 'c1000000-0000-4000-8000-000000000005', 'off-road-1-10-short-course', '1/10 Short Course', 1),
  ('c1000000-0000-4000-8000-000000000008', NULL, 'on-road', 'On-Road', 1),
  ('c1000000-0000-4000-8000-000000000009', 'c1000000-0000-4000-8000-000000000008', 'on-road-1-10-touring', '1/10 Touring Car', 0),
  ('c1000000-0000-4000-8000-00000000000a', 'c1000000-0000-4000-8000-000000000008', 'on-road-1-12-pan-car', '1/12 Pan Car', 1),
  ('c1000000-0000-4000-8000-00000000000b', NULL, 'stadium-truck', 'Stadium Truck', 2),
  ('c1000000-0000-4000-8000-00000000000c', 'c1000000-0000-4000-8000-00000000000b', 'stadium-truck-1-10-electric', '1/10 Electric Stadium Truck', 0);

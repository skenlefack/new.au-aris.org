-- Veille (information watch) module: schema "veille"
-- Apply: docker exec -i <pg> psql -U aris -d aris < add_veille_module.sql

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "veille";

-- CreateEnum
CREATE TYPE "veille"."WatchSourceType" AS ENUM ('RSS', 'GDELT');

-- CreateEnum
CREATE TYPE "veille"."WatchSignalStatus" AS ENUM ('NEW', 'IN_REVIEW', 'TO_VERIFY', 'VALIDATED', 'REJECTED', 'INTEGRATED');

-- CreateTable
CREATE TABLE "veille"."watch_sources" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" "veille"."WatchSourceType" NOT NULL DEFAULT 'RSS',
    "url" TEXT NOT NULL,
    "country_code" VARCHAR(2),
    "language" VARCHAR(5),
    "reliability" VARCHAR(1) NOT NULL DEFAULT 'C',
    "interval_minutes" INTEGER NOT NULL DEFAULT 60,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_run_at" TIMESTAMPTZ,
    "last_status" VARCHAR(20),
    "last_error" TEXT,
    "last_item_count" INTEGER NOT NULL DEFAULT 0,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "watch_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "veille"."watch_lists" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "domain" VARCHAR(50) NOT NULL,
    "campaign_id" UUID,
    "any_terms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "all_terms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "exclude_terms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "countries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "watch_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "veille"."watch_signals" (
    "id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "url_hash" VARCHAR(64) NOT NULL,
    "title_key" VARCHAR(64) NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "language" VARCHAR(5),
    "published_at" TIMESTAMPTZ,
    "collected_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "watch_list_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "domain" VARCHAR(50) NOT NULL,
    "category" VARCHAR(40) NOT NULL,
    "countries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "matched_terms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "relevance" INTEGER NOT NULL DEFAULT 0,
    "severity" INTEGER NOT NULL DEFAULT 1,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "reliability" VARCHAR(1) NOT NULL,
    "confidence" VARCHAR(20) NOT NULL DEFAULT 'RUMOR',
    "ai_summary" TEXT,
    "ai_classification" JSONB,
    "status" "veille"."WatchSignalStatus" NOT NULL DEFAULT 'NEW',
    "data_classification" VARCHAR(20) NOT NULL DEFAULT 'RESTRICTED',
    "campaign_id" UUID,
    "integration_target" VARCHAR(20),
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ,
    "review_note" TEXT,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "watch_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "veille"."watch_triage_actions" (
    "id" UUID NOT NULL,
    "signal_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "actor_role" VARCHAR(40) NOT NULL,
    "action" VARCHAR(30) NOT NULL,
    "from_status" VARCHAR(20),
    "to_status" VARCHAR(20),
    "note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "watch_triage_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_watch_source_active" ON "veille"."watch_sources"("is_active");

-- CreateIndex
CREATE INDEX "idx_watch_list_active" ON "veille"."watch_lists"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "watch_signals_url_hash_key" ON "veille"."watch_signals"("url_hash");

-- CreateIndex
CREATE INDEX "idx_watch_signal_status_priority" ON "veille"."watch_signals"("status", "priority");

-- CreateIndex
CREATE INDEX "idx_watch_signal_domain" ON "veille"."watch_signals"("domain");

-- CreateIndex
CREATE INDEX "idx_watch_signal_title_key" ON "veille"."watch_signals"("title_key");

-- CreateIndex
CREATE INDEX "idx_watch_signal_collected" ON "veille"."watch_signals"("collected_at");

-- CreateIndex
CREATE INDEX "idx_watch_action_signal" ON "veille"."watch_triage_actions"("signal_id");

-- AddForeignKey
ALTER TABLE "veille"."watch_signals" ADD CONSTRAINT "watch_signals_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "veille"."watch_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "veille"."watch_triage_actions" ADD CONSTRAINT "watch_triage_actions_signal_id_fkey" FOREIGN KEY ("signal_id") REFERENCES "veille"."watch_signals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

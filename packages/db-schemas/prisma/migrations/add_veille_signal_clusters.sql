-- Veille: group articles reporting the same story under one lead signal.
-- Apply after add_veille_module.sql. Idempotent.
ALTER TABLE "veille"."watch_signals" ADD COLUMN IF NOT EXISTS "cluster_id" UUID;
ALTER TABLE "veille"."watch_signals" ADD COLUMN IF NOT EXISTS "cluster_size" INTEGER NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS "idx_watch_signal_cluster" ON "veille"."watch_signals"("cluster_id");
DO $m$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'watch_signals_cluster_id_fkey') THEN
    ALTER TABLE "veille"."watch_signals" ADD CONSTRAINT "watch_signals_cluster_id_fkey"
      FOREIGN KEY ("cluster_id") REFERENCES "veille"."watch_signals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $m$;

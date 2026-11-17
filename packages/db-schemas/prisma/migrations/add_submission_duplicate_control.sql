-- Duplicate control on form submissions (2026-11).
-- Additive only: three nullable columns, existing rows keep NULL and are not modified.
-- Safe to run while collection is ongoing and before the new collecte image is deployed.

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS client_key       varchar(64),
  ADD COLUMN IF NOT EXISTS duplicate_status varchar(20),
  ADD COLUMN IF NOT EXISTS duplicate_info   jsonb;

-- NULL keys never collide, so fiches sent by older app versions are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS uq_submission_campaign_client_key
  ON public.submissions (campaign_id, client_key);

CREATE INDEX IF NOT EXISTS idx_submission_duplicate_status
  ON public.submissions (campaign_id, duplicate_status);

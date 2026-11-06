-- Interop hub: idempotency key on transactions (Idempotency-Key header on push/webhook).
-- A partner retrying the same request gets the original transaction instead of a duplicate.
ALTER TABLE interop.hub_transactions ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255);
CREATE UNIQUE INDEX IF NOT EXISTS hub_transactions_connection_id_idempotency_key_key
  ON interop.hub_transactions (connection_id, idempotency_key);

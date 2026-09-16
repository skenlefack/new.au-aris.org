-- ARIS 4.0 — Form Extensions: campaign-scoped field additions by REC/Country
-- Migration: add_form_extensions
-- Date: 2026-05-30
-- Non-destructive: creates new tables and types only, no existing table modification.

-- Enum types
DO $$ BEGIN
  CREATE TYPE form_builder."FormExtensionLevel" AS ENUM ('REC', 'COUNTRY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE form_builder."FormExtensionStatus" AS ENUM ('DRAFT', 'PENDING_VALIDATION', 'PUBLISHED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Form Extensions table
CREATE TABLE IF NOT EXISTS form_builder.form_extensions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_form_id    UUID NOT NULL,
  base_form_version INT NOT NULL,
  campaign_id     UUID NOT NULL,
  level           form_builder."FormExtensionLevel" NOT NULL,
  tenant_id       UUID NOT NULL,
  version         INT NOT NULL DEFAULT 1,
  status          form_builder."FormExtensionStatus" NOT NULL DEFAULT 'DRAFT',
  created_by      UUID NOT NULL,
  validated_by    UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_form_extension UNIQUE (base_form_id, campaign_id, level, tenant_id, version)
);

CREATE INDEX IF NOT EXISTS idx_form_ext_campaign_tenant ON form_builder.form_extensions (campaign_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_form_ext_base_form ON form_builder.form_extensions (base_form_id);

-- Form Extension Fields table
CREATE TABLE IF NOT EXISTS form_builder.form_extension_fields (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  extension_id      UUID NOT NULL REFERENCES form_builder.form_extensions(id) ON DELETE CASCADE,
  field_key         VARCHAR(255) NOT NULL,
  label_i18n        JSONB NOT NULL,
  type              VARCHAR(50) NOT NULL,
  required          BOOLEAN NOT NULL DEFAULT false,
  validation_rules  JSONB,
  reference_data_id UUID,
  properties        JSONB,
  "order"           INT NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_ext_field_key UNIQUE (extension_id, field_key)
);

CREATE INDEX IF NOT EXISTS idx_form_ext_field_ext ON form_builder.form_extension_fields (extension_id);

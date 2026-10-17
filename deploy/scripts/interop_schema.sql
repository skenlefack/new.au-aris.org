-- ARIS 4.0 — Interop Hub v3 Schema Creation
-- Run on PostgreSQL: psql -U aris -d aris -f interop_schema.sql

CREATE SCHEMA IF NOT EXISTS interop;

-- Enums
DO $$ BEGIN CREATE TYPE interop.hub_direction AS ENUM ('INBOUND','OUTBOUND'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE interop.hub_transport_type AS ENUM ('REST_API','SFTP','KAFKA','FILE_UPLOAD','WEBHOOK','DHIS2','FHIR','WAHIS','SOAP'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE interop.hub_auth_type AS ENUM ('NONE','BASIC','OAUTH2','API_KEY','BEARER_TOKEN','CERTIFICATE','HMAC'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE interop.hub_connection_status AS ENUM ('DRAFT','TESTING','ACTIVE','SUSPENDED','ARCHIVED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE interop.hub_pipeline_mode AS ENUM ('AUTOMATIC','MANUAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE interop.hub_pipeline_status AS ENUM ('DRAFT','ACTIVE','PAUSED','ERROR','ARCHIVED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE interop.hub_transaction_status AS ENUM ('RECEIVED','QUEUED','MAPPING','TRANSFORMING','VALIDATING','AWAITING_REVIEW','APPROVED','REJECTED','LOADING','COMPLETED','PARTIAL','FAILED','RETRY','CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE interop.hub_step_type AS ENUM ('RECEIVE','REFERENTIAL_MAP','FIELD_TRANSFORM','SCHEMA_VALIDATE','QUALITY_GATE','ENRICH','FORMAT_BUILD','ROUTE','NOTIFY','DELIVER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE interop.hub_export_format AS ENUM ('WOAH_JSON','WOAH_XML','EMPRES_JSON','FAOSTAT_CSV','FAOSTAT_JSON','FISHSTATJ_CSV','CITES_CSV','DHIS2_JSON','FHIR_JSON','CSV_GENERIC','JSON_GENERIC','EXCEL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE interop.hub_referential_type AS ENUM ('DISEASE','SPECIES','GEO_ADMIN','GEO_COUNTRY','UNIT','LAB','COMMODITY','MARKET','VACCINE','BREED','AGE_GROUP','PRODUCTION_SYSTEM','CUSTOM'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE interop.hub_schedule_frequency AS ENUM ('REALTIME','HOURLY','DAILY','WEEKLY','BIWEEKLY','MONTHLY','QUARTERLY','BIANNUAL','ANNUAL','ON_DEMAND'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE interop.hub_agreement_status AS ENUM ('DRAFT','PROPOSED','UNDER_REVIEW','ACCEPTED','ACTIVE','EXPIRED','REJECTED','REVOKED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE interop.hub_notification_type AS ENUM ('INBOUND_RECEIVED','INBOUND_AWAITING_REVIEW','INBOUND_APPROVED','INBOUND_REJECTED','INBOUND_LOADED','INBOUND_FAILED','OUTBOUND_READY','OUTBOUND_AWAITING_REVIEW','OUTBOUND_SENT','OUTBOUND_FAILED','CONNECTION_HEALTH_DOWN','CONNECTION_HEALTH_RESTORED','SLA_BREACH','PIPELINE_ERROR'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- hub_connections
CREATE TABLE IF NOT EXISTS interop.hub_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  system_type interop.hub_transport_type NOT NULL,
  system_name VARCHAR(255),
  system_version VARCHAR(50),
  country_code VARCHAR(3),
  country_name VARCHAR(100),
  organization VARCHAR(255),
  base_url VARCHAR(500),
  auth_type interop.hub_auth_type NOT NULL DEFAULT 'NONE',
  credentials JSONB NOT NULL DEFAULT '{}',
  headers JSONB NOT NULL DEFAULT '{}',
  tls_config JSONB,
  direction interop.hub_direction NOT NULL,
  domains TEXT[] NOT NULL DEFAULT '{}',
  status interop.hub_connection_status NOT NULL DEFAULT 'DRAFT',
  last_health_at TIMESTAMPTZ,
  last_health_ok BOOLEAN NOT NULL DEFAULT false,
  health_message TEXT,
  focal_technical JSONB,
  focal_data_owner JSONB,
  total_transactions INT NOT NULL DEFAULT 0,
  total_records INT NOT NULL DEFAULT 0,
  total_errors INT NOT NULL DEFAULT 0,
  last_transaction_at TIMESTAMPTZ,
  notes TEXT,
  config JSONB NOT NULL DEFAULT '{}',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

-- hub_pipelines
CREATE TABLE IF NOT EXISTS interop.hub_pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES interop.hub_connections(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  direction interop.hub_direction NOT NULL,
  domain VARCHAR(50) NOT NULL,
  sub_domain VARCHAR(50),
  entity_type VARCHAR(100),
  mode interop.hub_pipeline_mode NOT NULL DEFAULT 'MANUAL',
  status interop.hub_pipeline_status NOT NULL DEFAULT 'DRAFT',
  target_campaign_id UUID,
  target_form_id UUID,
  target_workflow_id UUID,
  export_format interop.hub_export_format,
  quality_gates_enabled BOOLEAN NOT NULL DEFAULT true,
  min_quality_score FLOAT DEFAULT 0.7,
  reject_on_quality_fail BOOLEAN NOT NULL DEFAULT false,
  max_retries INT NOT NULL DEFAULT 3,
  retry_delay_ms INT NOT NULL DEFAULT 60000,
  dlq_enabled BOOLEAN NOT NULL DEFAULT true,
  total_runs INT NOT NULL DEFAULT 0,
  successful_runs INT NOT NULL DEFAULT 0,
  failed_runs INT NOT NULL DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  last_run_status VARCHAR(20),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(connection_id, domain, direction)
);

-- hub_pipeline_steps
CREATE TABLE IF NOT EXISTS interop.hub_pipeline_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID NOT NULL REFERENCES interop.hub_pipelines(id) ON DELETE CASCADE,
  step_order INT NOT NULL,
  step_type interop.hub_step_type NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  config JSONB NOT NULL DEFAULT '{}',
  on_error VARCHAR(20) NOT NULL DEFAULT 'STOP',
  timeout_ms INT NOT NULL DEFAULT 30000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(pipeline_id, step_order)
);

-- hub_referential_mappings
CREATE TABLE IF NOT EXISTS interop.hub_referential_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES interop.hub_connections(id) ON DELETE CASCADE,
  referential_type interop.hub_referential_type NOT NULL,
  direction interop.hub_direction NOT NULL DEFAULT 'INBOUND',
  source_code VARCHAR(100) NOT NULL,
  source_label VARCHAR(255),
  target_code VARCHAR(100) NOT NULL,
  target_label VARCHAR(255),
  target_id UUID,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(connection_id, referential_type, direction, source_code)
);

-- hub_field_mappings
CREATE TABLE IF NOT EXISTS interop.hub_field_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES interop.hub_connections(id) ON DELETE CASCADE,
  entity_type VARCHAR(100) NOT NULL,
  direction interop.hub_direction NOT NULL,
  source_field VARCHAR(255) NOT NULL,
  target_field VARCHAR(255) NOT NULL,
  transformation TEXT,
  default_value TEXT,
  is_required BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(connection_id, entity_type, direction, source_field, target_field)
);

-- hub_schedules
CREATE TABLE IF NOT EXISTS interop.hub_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES interop.hub_connections(id) ON DELETE CASCADE,
  pipeline_id UUID,
  tenant_id UUID NOT NULL,
  frequency interop.hub_schedule_frequency NOT NULL,
  cron_expression VARCHAR(100),
  timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
  window_start VARCHAR(10),
  window_end VARCHAR(10),
  period_type VARCHAR(20),
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  last_run_ok BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- hub_transactions
CREATE TABLE IF NOT EXISTS interop.hub_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID NOT NULL REFERENCES interop.hub_pipelines(id),
  connection_id UUID NOT NULL REFERENCES interop.hub_connections(id),
  tenant_id UUID NOT NULL,
  direction interop.hub_direction NOT NULL,
  status interop.hub_transaction_status NOT NULL DEFAULT 'RECEIVED',
  current_step VARCHAR(100),
  mode interop.hub_pipeline_mode NOT NULL,
  domain VARCHAR(50) NOT NULL,
  entity_type VARCHAR(100),
  country_code VARCHAR(3),
  target_campaign_id UUID,
  target_form_id UUID,
  export_format interop.hub_export_format,
  records_total INT NOT NULL DEFAULT 0,
  records_accepted INT NOT NULL DEFAULT 0,
  records_rejected INT NOT NULL DEFAULT 0,
  records_warning INT NOT NULL DEFAULT 0,
  source_payload JSONB,
  mapped_payload JSONB,
  target_payload JSONB,
  validation_report JSONB,
  rejection_details JSONB,
  source_file_url VARCHAR(500),
  source_file_name VARCHAR(255),
  source_file_size INT,
  output_file_url VARCHAR(500),
  output_file_name VARCHAR(255),
  output_file_size INT,
  delivery_url VARCHAR(500),
  delivery_method VARCHAR(20),
  delivery_status INT,
  delivery_response TEXT,
  error_message TEXT,
  error_details JSONB,
  retry_count INT NOT NULL DEFAULT 0,
  max_retries INT NOT NULL DEFAULT 3,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  initiated_by UUID NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- hub_transaction_records
CREATE TABLE IF NOT EXISTS interop.hub_transaction_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES interop.hub_transactions(id) ON DELETE CASCADE,
  record_index INT NOT NULL,
  status VARCHAR(20) NOT NULL,
  error_message TEXT,
  error_fields JSONB,
  source_data JSONB,
  mapped_data JSONB,
  target_data JSONB,
  submission_id UUID,
  form_entry_id UUID,
  quality_score FLOAT,
  quality_report JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- hub_transaction_step_logs
CREATE TABLE IF NOT EXISTS interop.hub_transaction_step_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES interop.hub_transactions(id) ON DELETE CASCADE,
  step_type interop.hub_step_type NOT NULL,
  step_name VARCHAR(255) NOT NULL,
  step_order INT NOT NULL,
  status VARCHAR(20) NOT NULL,
  input_summary JSONB,
  output_summary JSONB,
  error_message TEXT,
  duration_ms INT,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ
);

-- hub_agreements
CREATE TABLE IF NOT EXISTS interop.hub_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES interop.hub_connections(id),
  reference VARCHAR(50) NOT NULL UNIQUE,
  tenant_id UUID NOT NULL,
  owner_tenant_id UUID NOT NULL,
  owner_name VARCHAR(255) NOT NULL,
  partner_tenant_id UUID,
  partner_name VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  purpose TEXT,
  legal_basis TEXT,
  domains TEXT[] NOT NULL DEFAULT '{}',
  direction interop.hub_direction NOT NULL,
  data_scope JSONB,
  data_classification VARCHAR(20),
  frequency interop.hub_schedule_frequency,
  timeliness_sla_hours INT,
  quality_min_score FLOAT,
  status interop.hub_agreement_status NOT NULL DEFAULT 'DRAFT',
  proposed_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- hub_notifications
CREATE TABLE IF NOT EXISTS interop.hub_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  transaction_id UUID,
  connection_id UUID,
  type interop.hub_notification_type NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  severity VARCHAR(10) NOT NULL DEFAULT 'INFO',
  metadata JSONB NOT NULL DEFAULT '{}',
  channels TEXT[] NOT NULL DEFAULT '{}',
  sent_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  read_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- hub_health_checks
CREATE TABLE IF NOT EXISTS interop.hub_health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL,
  status VARCHAR(20) NOT NULL,
  response_time_ms INT,
  status_code INT,
  error_message TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- hub_audit_logs
CREATE TABLE IF NOT EXISTS interop.hub_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL,
  actor_id UUID NOT NULL,
  actor_role VARCHAR(50) NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_hub_conn_tenant ON interop.hub_connections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hub_conn_direction ON interop.hub_connections(direction);
CREATE INDEX IF NOT EXISTS idx_hub_conn_status ON interop.hub_connections(status);
CREATE INDEX IF NOT EXISTS idx_hub_pipe_tenant ON interop.hub_pipelines(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hub_pipe_conn ON interop.hub_pipelines(connection_id);
CREATE INDEX IF NOT EXISTS idx_hub_pipe_status ON interop.hub_pipelines(status);
CREATE INDEX IF NOT EXISTS idx_hub_tx_pipeline ON interop.hub_transactions(pipeline_id, status);
CREATE INDEX IF NOT EXISTS idx_hub_tx_conn ON interop.hub_transactions(connection_id, created_at);
CREATE INDEX IF NOT EXISTS idx_hub_tx_tenant ON interop.hub_transactions(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_hub_tx_status ON interop.hub_transactions(status);
CREATE INDEX IF NOT EXISTS idx_hub_tx_direction ON interop.hub_transactions(direction, status);
CREATE INDEX IF NOT EXISTS idx_hub_notif_tenant ON interop.hub_notifications(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_hub_audit_tenant ON interop.hub_audit_logs(tenant_id, created_at);

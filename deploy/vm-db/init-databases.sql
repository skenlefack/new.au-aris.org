-- ARIS 4.0 — PostgreSQL Database Initialization
-- Creates one schema per microservice for isolation + PostGIS extension

-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Per-service schemas (Prisma multi-schema approach)
CREATE SCHEMA IF NOT EXISTS tenant;
CREATE SCHEMA IF NOT EXISTS credential;
CREATE SCHEMA IF NOT EXISTS master_data;
CREATE SCHEMA IF NOT EXISTS data_quality;
CREATE SCHEMA IF NOT EXISTS data_contract;
CREATE SCHEMA IF NOT EXISTS message;
CREATE SCHEMA IF NOT EXISTS drive;
CREATE SCHEMA IF NOT EXISTS form_builder;
CREATE SCHEMA IF NOT EXISTS collecte;
CREATE SCHEMA IF NOT EXISTS workflow;
CREATE SCHEMA IF NOT EXISTS animal_health;
CREATE SCHEMA IF NOT EXISTS livestock_prod;
CREATE SCHEMA IF NOT EXISTS fisheries;
CREATE SCHEMA IF NOT EXISTS wildlife;
CREATE SCHEMA IF NOT EXISTS apiculture;
CREATE SCHEMA IF NOT EXISTS trade_sps;
CREATE SCHEMA IF NOT EXISTS governance;
CREATE SCHEMA IF NOT EXISTS climate_env;
CREATE SCHEMA IF NOT EXISTS analytics;
CREATE SCHEMA IF NOT EXISTS geo_services;
CREATE SCHEMA IF NOT EXISTS knowledge_hub;
CREATE SCHEMA IF NOT EXISTS interop_hub;
CREATE SCHEMA IF NOT EXISTS interop_v2;
CREATE SCHEMA IF NOT EXISTS offline;
CREATE SCHEMA IF NOT EXISTS support;
CREATE SCHEMA IF NOT EXISTS audit;

-- Audit log table (shared across all services)
CREATE TABLE IF NOT EXISTS audit.audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,
    actor_user_id UUID,
    actor_role VARCHAR(50),
    actor_tenant_id UUID,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reason TEXT,
    previous_version JSONB,
    new_version JSONB,
    data_classification VARCHAR(20) NOT NULL DEFAULT 'RESTRICTED',
    service_name VARCHAR(50) NOT NULL,
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit.audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit.audit_log(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit.audit_log(actor_tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit.audit_log(timestamp);

-- Grant permissions (aris is the database owner, but grant explicit schema usage)
GRANT ALL ON ALL TABLES IN SCHEMA audit TO aris;
DO $$
DECLARE
  s TEXT;
BEGIN
  FOR s IN
    SELECT schema_name FROM information_schema.schemata
    WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
  LOOP
    EXECUTE format('GRANT USAGE ON SCHEMA %I TO aris', s);
    EXECUTE format('GRANT ALL ON ALL TABLES IN SCHEMA %I TO aris', s);
    EXECUTE format('GRANT ALL ON ALL SEQUENCES IN SCHEMA %I TO aris', s);
  END LOOP;
END $$;

COMMENT ON DATABASE aris IS 'ARIS 4.0 — Animal Resources Information System — AU-IBAR';

-- Datalake OLAP schema
CREATE SCHEMA IF NOT EXISTS datalake;
GRANT ALL ON ALL TABLES IN SCHEMA datalake TO aris;

-- Historical data schema
CREATE SCHEMA IF NOT EXISTS historical;
GRANT ALL ON ALL TABLES IN SCHEMA historical TO aris;

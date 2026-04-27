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
CREATE SCHEMA IF NOT EXISTS data_sharing;
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

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA audit TO aris;
GRANT USAGE ON ALL SCHEMAS TO aris;

COMMENT ON DATABASE aris IS 'ARIS 4.0 — Animal Resources Information System — AU-IBAR';

-- Datalake OLAP schema
CREATE SCHEMA IF NOT EXISTS datalake;
GRANT ALL ON ALL TABLES IN SCHEMA datalake TO aris;

-- Historical data schema
CREATE SCHEMA IF NOT EXISTS historical;
GRANT ALL ON ALL TABLES IN SCHEMA historical TO aris;

-- AI / ML schema
CREATE SCHEMA IF NOT EXISTS ai;

CREATE TABLE IF NOT EXISTS ai.ml_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL,          -- xgboost, isolation_forest, hdbscan, chronos
    version INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL DEFAULT 'REGISTERED', -- REGISTERED, TRAINING, READY, FAILED, RETIRED
    config JSONB NOT NULL DEFAULT '{}',
    accuracy DOUBLE PRECISION,
    metrics JSONB,
    artifact_path TEXT,
    trained_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai.ml_training_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_id UUID NOT NULL REFERENCES ai.ml_models(id),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING, RUNNING, COMPLETED, FAILED
    triggered_by VARCHAR(20) NOT NULL DEFAULT 'SCHEDULE', -- SCHEDULE, MANUAL, API
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    input_row_count INTEGER,
    metrics JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ml_models_code ON ai.ml_models(code);
CREATE INDEX IF NOT EXISTS idx_ml_models_status ON ai.ml_models(status);
CREATE INDEX IF NOT EXISTS idx_ml_training_model ON ai.ml_training_jobs(model_id);
CREATE INDEX IF NOT EXISTS idx_ml_training_status ON ai.ml_training_jobs(status);

-- Seed default models
INSERT INTO ai.ml_models (id, code, name, type, status, config, description) VALUES
    (uuid_generate_v4(), 'epidemic_predictor', 'Epidemic Predictor (XGBoost)', 'xgboost', 'REGISTERED',
     '{"indicator_codes": ["OBR-001","OBR-002","OBR-003"], "since_days": 1095, "xgb_params": {"n_estimators": 100, "max_depth": 6, "learning_rate": 0.1}}',
     'Predicts outbreak risk based on historical event data and indicator time series'),
    (uuid_generate_v4(), 'anomaly_detector', 'Anomaly Detector (Isolation Forest)', 'isolation_forest', 'REGISTERED',
     '{"contamination": 0.05, "n_estimators": 200}',
     'Detects anomalous data points in submitted records using Isolation Forest'),
    (uuid_generate_v4(), 'spatial_clusterer', 'Spatial Clusterer (HDBSCAN)', 'hdbscan', 'REGISTERED',
     '{"min_cluster_size": 5, "min_samples": 3}',
     'Spatial clustering of geographic events for hotspot detection')
ON CONFLICT (code) DO NOTHING;

GRANT ALL ON ALL TABLES IN SCHEMA ai TO aris;
GRANT USAGE ON SCHEMA ai TO aris;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA ai TO aris;

-- Metabase needs its own database for internal application tables
-- Run separately: CREATE DATABASE metabase OWNER aris;

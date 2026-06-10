-- PAID v2 Schema — New hierarchical tables for LICS projects
-- Run in: animal_health schema on PostgreSQL 16

-- ============================================================
-- 1. Drop old PAID tables
-- ============================================================
DROP TABLE IF EXISTS animal_health.paid_partners_national CASCADE;
DROP TABLE IF EXISTS animal_health.paid_partners_intl CASCADE;
DROP TABLE IF EXISTS animal_health.paid_projects CASCADE;
DROP TABLE IF EXISTS animal_health.paid_diseases CASCADE;
DROP TABLE IF EXISTS animal_health.paid_production_systems CASCADE;
DROP TABLE IF EXISTS animal_health.paid_species CASCADE;
DROP TABLE IF EXISTS animal_health.paid_activities CASCADE;
DROP TABLE IF EXISTS animal_health.paid_sectors CASCADE;

-- ============================================================
-- 2. Create new PAID v2 tables
-- ============================================================

-- Projects (LICS: OHDAA, ANGR, LIVESYS, VET_GOV)
CREATE TABLE IF NOT EXISTS animal_health.paid_projects (
  id SERIAL PRIMARY KEY,
  code VARCHAR(30) NOT NULL UNIQUE,
  title TEXT NOT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'single_country',
  countries TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_paid_projects_type ON animal_health.paid_projects(type);

-- Executive partners (per project)
CREATE TABLE IF NOT EXISTS animal_health.paid_executive_partners (
  id SERIAL PRIMARY KEY,
  project_code VARCHAR(30) NOT NULL,
  name VARCHAR(300) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_paid_exec_partners_project ON animal_health.paid_executive_partners(project_code);

-- Implementing partners international (per project)
CREATE TABLE IF NOT EXISTS animal_health.paid_impl_partners_intl (
  id SERIAL PRIMARY KEY,
  project_code VARCHAR(30) NOT NULL,
  name VARCHAR(300) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_paid_impl_intl_project ON animal_health.paid_impl_partners_intl(project_code);

-- Implementing partners national (per project + country)
CREATE TABLE IF NOT EXISTS animal_health.paid_impl_partners_national (
  id SERIAL PRIMARY KEY,
  project_code VARCHAR(30) NOT NULL,
  country_code VARCHAR(5),
  name VARCHAR(300) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_paid_impl_nat_project ON animal_health.paid_impl_partners_national(project_code);
CREATE INDEX idx_paid_impl_nat_country ON animal_health.paid_impl_partners_national(country_code);

-- Log Frame Activity (AMERT) — per project
CREATE TABLE IF NOT EXISTS animal_health.paid_logframes (
  id SERIAL PRIMARY KEY,
  code VARCHAR(30) NOT NULL UNIQUE,
  project_code VARCHAR(30) NOT NULL,
  label TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_paid_logframes_project ON animal_health.paid_logframes(project_code);

-- Activity — per logframe
CREATE TABLE IF NOT EXISTS animal_health.paid_lf_activities (
  id SERIAL PRIMARY KEY,
  code VARCHAR(30) NOT NULL UNIQUE,
  logframe_code VARCHAR(30) NOT NULL,
  label TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_paid_lf_activities_logframe ON animal_health.paid_lf_activities(logframe_code);

-- Sub-activity — per activity
CREATE TABLE IF NOT EXISTS animal_health.paid_subactivities (
  id SERIAL PRIMARY KEY,
  code VARCHAR(30) NOT NULL UNIQUE,
  activity_code VARCHAR(30) NOT NULL,
  label TEXT NOT NULL,
  unit_of_measure VARCHAR(100),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_paid_subactivities_activity ON animal_health.paid_subactivities(activity_code);

-- PAID Activity — per sub-activity (carries the unit of measure)
CREATE TABLE IF NOT EXISTS animal_health.paid_paid_activities (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  subactivity_code VARCHAR(30) NOT NULL,
  label TEXT NOT NULL,
  unit_of_measure VARCHAR(100),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_paid_paid_activities_sub ON animal_health.paid_paid_activities(subactivity_code);

-- Breakdown fields config (dynamic fields per PAID activity)
CREATE TABLE IF NOT EXISTS animal_health.paid_breakdown_fields (
  id SERIAL PRIMARY KEY,
  paid_activity_code VARCHAR(50) NOT NULL,
  field_code VARCHAR(50) NOT NULL,
  field_label TEXT NOT NULL,
  field_type VARCHAR(20) NOT NULL DEFAULT 'number',
  field_options JSONB,
  sort_order INT NOT NULL DEFAULT 0,
  is_required BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(paid_activity_code, field_code)
);
CREATE INDEX idx_paid_breakdown_pa ON animal_health.paid_breakdown_fields(paid_activity_code);

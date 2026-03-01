-- ═══════════════════════════════════════════
-- ARIS BI Tools — Read-Only User
-- ═══════════════════════════════════════════
-- Run against the ARIS database after initial setup:
--   docker exec -i aris-postgres psql -U aris -d aris < docker/postgres/init-bi-user.sql

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'aris_bi_reader') THEN
    CREATE USER aris_bi_reader WITH PASSWORD 'BiReader2024!';
  END IF;
END
$$;

GRANT CONNECT ON DATABASE aris TO aris_bi_reader;

-- Schema public (master data, collecte, workflow tables)
GRANT USAGE ON SCHEMA public TO aris_bi_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO aris_bi_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO aris_bi_reader;

-- Historical schema (imported datasets)
CREATE SCHEMA IF NOT EXISTS historical;
GRANT USAGE ON SCHEMA historical TO aris_bi_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA historical TO aris_bi_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA historical GRANT SELECT ON TABLES TO aris_bi_reader;

-- Revoke access to sensitive tables (ignore errors if tables don't exist yet)
DO $$
BEGIN
  EXECUTE 'REVOKE SELECT ON TABLE "User" FROM aris_bi_reader';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE 'REVOKE SELECT ON TABLE "Session" FROM aris_bi_reader';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE 'REVOKE SELECT ON TABLE "RefreshToken" FROM aris_bi_reader';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE 'REVOKE SELECT ON TABLE "AuditLog" FROM aris_bi_reader';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

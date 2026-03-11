-- ═══════════════════════════════════════════
-- ARIS BI Tools — Read-Only User (Production)
-- ═══════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'aris_bi_reader') THEN
    CREATE USER aris_bi_reader WITH PASSWORD 'B1R34d3r_Pr0d_2024!gH5jK';
  END IF;
END
$$;

GRANT CONNECT ON DATABASE aris TO aris_bi_reader;

-- Schema public
GRANT USAGE ON SCHEMA public TO aris_bi_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO aris_bi_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO aris_bi_reader;

-- Historical schema
CREATE SCHEMA IF NOT EXISTS historical;
GRANT USAGE ON SCHEMA historical TO aris_bi_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA historical TO aris_bi_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA historical GRANT SELECT ON TABLES TO aris_bi_reader;

-- Domain schemas — grant read access to ALL business schemas
DO $$ DECLARE s TEXT;
BEGIN
  FOR s IN SELECT unnest(ARRAY[
    'animal_health','livestock_prod','fisheries','wildlife','apiculture',
    'trade_sps','governance','climate_env','collecte','workflow',
    'form_builder','master_data','analytics','geo_services',
    'knowledge_hub','datalake','tenant','credential'
  ]) LOOP
    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', s);
    EXECUTE format('GRANT USAGE ON SCHEMA %I TO aris_bi_reader', s);
    EXECUTE format('GRANT SELECT ON ALL TABLES IN SCHEMA %I TO aris_bi_reader', s);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT SELECT ON TABLES TO aris_bi_reader', s);
  END LOOP;
END $$;

-- Revoke access to sensitive tables
DO $$ DECLARE tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY['User','Session','RefreshToken','AuditLog']) LOOP
    BEGIN
      EXECUTE format('REVOKE SELECT ON TABLE public.%I FROM aris_bi_reader', tbl);
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
  END LOOP;

  FOR tbl IN SELECT unnest(ARRAY['users','sessions','refresh_tokens','audit_logs','mfa_secrets']) LOOP
    BEGIN
      EXECUTE format('REVOKE SELECT ON TABLE credential.%I FROM aris_bi_reader', tbl);
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
  END LOOP;

  FOR tbl IN SELECT unnest(ARRAY['settings']) LOOP
    BEGIN
      EXECUTE format('REVOKE SELECT ON TABLE tenant.%I FROM aris_bi_reader', tbl);
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
  END LOOP;
END $$;

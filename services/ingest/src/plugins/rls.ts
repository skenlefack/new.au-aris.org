/**
 * Row-Level Security (RLS) setup for the ingest schema.
 * R7 level 4: defense-in-depth — tenant isolation enforced at DB level.
 *
 * To apply: run the SQL in rls-setup.sql on the database.
 * The Prisma middleware sets app.tenant_id on each query.
 */

/**
 * SQL to enable RLS on all ingest tables.
 * Run this once after schema creation (via prisma db push or manually).
 */
export const RLS_SETUP_SQL = `
-- Enable RLS on all ingest tables
ALTER TABLE ingest.ingest_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingest.source_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingest.column_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingest.form_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingest.match_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingest.field_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingest.campaign_resolutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingest.ingest_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingest.row_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingest.mapping_corrections ENABLE ROW LEVEL SECURITY;

-- Policy: ingest_files — direct tenant_id
CREATE POLICY tenant_isolation_ingest_files ON ingest.ingest_files
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Policy: form_signatures — direct tenant_id
CREATE POLICY tenant_isolation_form_signatures ON ingest.form_signatures
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Policy: mapping_corrections — direct tenant_id
CREATE POLICY tenant_isolation_mapping_corrections ON ingest.mapping_corrections
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Policy: source_profiles — via ingest_files FK
CREATE POLICY tenant_isolation_source_profiles ON ingest.source_profiles
  USING (EXISTS (SELECT 1 FROM ingest.ingest_files f WHERE f.id = file_id AND f.tenant_id = current_setting('app.tenant_id', true)::uuid));

-- Policy: match_proposals — via ingest_files FK
CREATE POLICY tenant_isolation_match_proposals ON ingest.match_proposals
  USING (EXISTS (SELECT 1 FROM ingest.ingest_files f WHERE f.id = file_id AND f.tenant_id = current_setting('app.tenant_id', true)::uuid));

-- Policy: campaign_resolutions — via ingest_files FK
CREATE POLICY tenant_isolation_campaign_resolutions ON ingest.campaign_resolutions
  USING (EXISTS (SELECT 1 FROM ingest.ingest_files f WHERE f.id = file_id AND f.tenant_id = current_setting('app.tenant_id', true)::uuid));

-- Policy: ingest_runs — via ingest_files FK
CREATE POLICY tenant_isolation_ingest_runs ON ingest.ingest_runs
  USING (EXISTS (SELECT 1 FROM ingest.ingest_files f WHERE f.id = file_id AND f.tenant_id = current_setting('app.tenant_id', true)::uuid));

-- Bypass for the service role (prisma connects as 'aris')
ALTER TABLE ingest.ingest_files FORCE ROW LEVEL SECURITY;
ALTER TABLE ingest.source_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE ingest.form_signatures FORCE ROW LEVEL SECURITY;
ALTER TABLE ingest.mapping_corrections FORCE ROW LEVEL SECURITY;
`;

/**
 * Prisma middleware to set app.tenant_id on each query for RLS enforcement.
 * Add to the PrismaClient instance in app.ts.
 */
export function createRlsMiddleware(prisma: { $executeRawUnsafe: (sql: string) => Promise<unknown> }) {
  return async function setTenantContext(tenantId: string): Promise<void> {
    await prisma.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
  };
}

/**
 * Seed data for the Collecte service.
 *
 * Creates:
 * - 1 active campaign: "Kenya FMD Surveillance Q1 2025"
 *   linked to the "Animal Disease Event Report" template from form-builder
 */

// Well-known UUIDs for seed data (deterministic for repeatability)
export const SEED_TENANT_KE = '00000000-0000-0000-0000-000000000100';
export const SEED_TEMPLATE_ID = '00000000-0000-0000-0000-000000000200';
export const SEED_USER_ADMIN = '00000000-0000-0000-0000-000000000301';
export const SEED_USER_AGENT_1 = '00000000-0000-0000-0000-000000000302';
export const SEED_USER_AGENT_2 = '00000000-0000-0000-0000-000000000303';
export const SEED_ZONE_NAIROBI = '00000000-0000-0000-0000-000000000401';
export const SEED_ZONE_MOMBASA = '00000000-0000-0000-0000-000000000402';
export const SEED_ZONE_KISUMU = '00000000-0000-0000-0000-000000000403';
export const SEED_ZONE_NAKURU = '00000000-0000-0000-0000-000000000404';
export const SEED_ZONE_ELDORET = '00000000-0000-0000-0000-000000000405';

export const SEED_CAMPAIGN = {
  tenantId: SEED_TENANT_KE,
  name: 'Kenya FMD Surveillance Q1 2025',
  domain: 'health',
  templateId: SEED_TEMPLATE_ID,
  startDate: new Date('2025-01-01'),
  endDate: new Date('2025-03-31'),
  targetZones: [
    SEED_ZONE_NAIROBI,
    SEED_ZONE_MOMBASA,
    SEED_ZONE_KISUMU,
    SEED_ZONE_NAKURU,
    SEED_ZONE_ELDORET,
  ],
  assignedAgents: [SEED_USER_AGENT_1, SEED_USER_AGENT_2],
  targetSubmissions: 500,
  status: 'ACTIVE' as const,
  description:
    'Quarterly foot-and-mouth disease surveillance campaign covering 5 counties in Kenya. ' +
    'Field agents collect outbreak reports using the Animal Disease Event template. ' +
    'Linked to WAHIS reporting obligations.',
  conflictStrategy: 'LAST_WRITE_WINS' as const,
  createdBy: SEED_USER_ADMIN,
};

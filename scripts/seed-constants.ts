/**
 * ARIS 4.0 — Shared Seed Constants
 *
 * Deterministic UUIDs and cross-service references for all domain seeds.
 * These match the values established by tenant, credential, and master-data seeds.
 */

// ── Tenant IDs (from seed-tenant.ts) ─────────────────────────────────────
export const TENANT_AU_IBAR = '00000000-0000-4000-a000-000000000001';
export const TENANT_IGAD = '00000000-0000-4000-a000-000000000010';
export const TENANT_KE = '00000000-0000-4000-a000-000000000101';

// ── User IDs (from seed-credential.ts) ───────────────────────────────────
export const USER_SUPER_ADMIN = '10000000-0000-4000-a000-000000000001';
export const USER_KE_ADMIN = '10000000-0000-4000-a000-000000000101';

// ── Species Codes (resolved at runtime by code) ─────────────────────────
export const SPECIES = {
  CATTLE_TAURINE: 'BOS-TAU',
  CATTLE_ZEBU: 'BOS-IND',
  SHEEP: 'OVI-ARI',
  GOAT: 'CAP-HIR',
  PIG: 'SUS-DOM',
  CHICKEN: 'GAL-DOM',
  CAMEL: 'CAM-DRO',
  HORSE: 'EQU-CAB',
  DONKEY: 'EQU-ASI',
  TILAPIA: 'ORE-NIL',
  NILE_PERCH: 'LAT-NIL',
  TUNA: 'THU-ALB',
  PRAWN: 'PEN-MON',
  CATFISH: 'CLA-GAR',
  ELEPHANT: 'LOX-AFR',
  LION: 'PAN-LEO',
  RHINO_BLACK: 'DIC-BIC',
  RHINO_WHITE: 'CER-SIM',
  BUFFALO: 'SYN-CAF',
  GIRAFFE: 'GIR-CAM',
  HIPPO: 'HIP-AMP',
  WILDEBEEST: 'CON-TAU',
  WARTHOG: 'PHA-AET',
  HONEY_BEE: 'API-MEL',
  AFRICAN_BEE: 'API-ADA',
  EA_BEE: 'API-SCU',
} as const;

// ── Disease Codes (resolved at runtime by code) ─────────────────────────
export const DISEASE = {
  FMD: 'FMD',
  PPR: 'PPR',
  RVF: 'RVF',
  CBPP: 'CBPP',
  ASF: 'ASF',
  HPAI: 'HPAI',
  LSD: 'LSD',
  NCD: 'NCD',
  BRUCELLOSIS_B: 'BRU-B',
  ECF: 'ECF',
  VARROOSIS: 'VAR',
  NOSEMA: 'AFB', // American foulbrood (closest bee disease in seed)
} as const;

// ── Kenya Admin1 Codes (resolved at runtime by code) ────────────────────
export const GEO = {
  KENYA: 'KE',
  NAIROBI: 'KE-30',
  MOMBASA: 'KE-01',
  KISUMU: 'KE-42',
  NAKURU: 'KE-32',
  KIAMBU: 'KE-22',
  KILIFI: 'KE-03',
  GARISSA: 'KE-07',
  MARSABIT: 'KE-10',
  MERU: 'KE-12',
  // Trade partner countries
  UGANDA: 'UG',
  TANZANIA: 'TZ',
  ETHIOPIA: 'ET',
  SOMALIA: 'SO',
} as const;

// ── Deterministic UUID generator for domain entities ─────────────────────
// Format: {domain-prefix}-0000-4000-a000-{sequence}
// Domain prefixes:
//   20000000 = animal-health
//   21000000 = livestock-prod
//   22000000 = fisheries
//   23000000 = wildlife
//   24000000 = apiculture
//   25000000 = trade-sps
//   26000000 = governance
//   27000000 = climate-env
//   28000000 = markets/facilities (shared)

export function domainId(domainPrefix: string, seq: number): string {
  return `${domainPrefix}-0000-4000-a000-${String(seq).padStart(12, '0')}`;
}

// Pre-defined prefixes
export const PREFIX = {
  ANIMAL_HEALTH: '20000000',
  LIVESTOCK: '21000000',
  FISHERIES: '22000000',
  WILDLIFE: '23000000',
  APICULTURE: '24000000',
  TRADE: '25000000',
  GOVERNANCE: '26000000',
  CLIMATE: '27000000',
  FACILITY: '28000000',
} as const;

// ── Market / Facility IDs ────────────────────────────────────────────────
export const MARKET_NAIROBI = domainId(PREFIX.FACILITY, 1);
export const MARKET_MOMBASA = domainId(PREFIX.FACILITY, 2);
export const MARKET_KISUMU = domainId(PREFIX.FACILITY, 3);
export const FACILITY_DAGORETTI = domainId(PREFIX.FACILITY, 10);
export const FACILITY_ATHI_RIVER = domainId(PREFIX.FACILITY, 11);

// ── Helper: resolve master data IDs at runtime ──────────────────────────
import { PrismaClient } from '@prisma/client';

export interface MasterDataIds {
  species: Map<string, string>; // code → id
  diseases: Map<string, string>; // code → id
  geoEntities: Map<string, string>; // code → id
}

export async function resolveMasterDataIds(
  prisma: PrismaClient,
): Promise<MasterDataIds> {
  const [speciesList, diseaseList, geoList] = await Promise.all([
    prisma.species.findMany({ select: { id: true, code: true } }),
    prisma.disease.findMany({ select: { id: true, code: true } }),
    prisma.geoEntity.findMany({ select: { id: true, code: true } }),
  ]);

  return {
    species: new Map(speciesList.map((s) => [s.code, s.id])),
    diseases: new Map(diseaseList.map((d) => [d.code, d.id])),
    geoEntities: new Map(geoList.map((g) => [g.code, g.id])),
  };
}

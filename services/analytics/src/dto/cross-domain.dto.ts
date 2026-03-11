// ── Kafka topic constants (domain events consumed by analytics) ──
// Defined locally since CC-4 does not own @aris/shared-types.
// Naming follows CLAUDE.md convention: {scope}.{domain}.{entity}.{action}.v{version}

export const TOPIC_MS_LIVESTOCK_CENSUS_CREATED = 'ms.livestock.census.created.v1' as const;
export const TOPIC_MS_FISHERIES_CAPTURE_RECORDED = 'ms.fisheries.capture.recorded.v1' as const;
export const TOPIC_MS_WILDLIFE_CRIME_REPORTED = 'ms.wildlife.crime.reported.v1' as const;
export const TOPIC_MS_TRADE_FLOW_CREATED = 'ms.trade.flow.created.v1' as const;
export const TOPIC_MS_CLIMATE_HOTSPOT_DETECTED = 'ms.climate.hotspot.detected.v1' as const;
export const TOPIC_MS_APICULTURE_PRODUCTION_RECORDED = 'ms.apiculture.production.recorded.v1' as const;
export const TOPIC_MS_GOVERNANCE_PVS_EVALUATED = 'ms.governance.pvs.evaluated.v1' as const;

// ── Kafka event payloads ──

export interface LivestockCensusPayload {
  id: string;
  tenantId: string;
  countryCode: string;
  speciesId: string;
  speciesName?: string;
  population: number;
  year: number;
  timestamp?: string;
}

export interface FishCapturePayload {
  id: string;
  tenantId: string;
  countryCode: string;
  speciesId: string;
  quantityKg: number;
  gearType: string;
  landingSite: string;
  timestamp?: string;
}

export interface WildlifeCrimePayload {
  id: string;
  tenantId: string;
  countryCode: string;
  crimeType: string;
  speciesIds: string[];
  protectedAreaId?: string;
  protectedAreaName?: string;
  seizureQuantity?: number;
  timestamp?: string;
}

export interface TradeFlowPayload {
  id: string;
  tenantId: string;
  countryCode: string;
  partnerCountryCode: string;
  flowDirection: 'IMPORT' | 'EXPORT' | 'TRANSIT';
  commodity: string;
  valueFob?: number;
  currency: string;
  quantity: number;
  unit: string;
  timestamp?: string;
}

export interface ClimateHotspotPayload {
  id: string;
  tenantId: string;
  countryCode: string;
  type: string;
  severity: string;
  geoEntityId: string;
  affectedSpecies: string[];
  timestamp?: string;
}

export interface ApicultureProductionPayload {
  id: string;
  tenantId: string;
  countryCode: string;
  apiaryId: string;
  quantityKg: number;
  quality: string;
  floralSource: string;
  timestamp?: string;
}

export interface GovernancePvsPayload {
  id: string;
  tenantId: string;
  countryCode: string;
  evaluationType: string;
  overallScore: number;
  year: number;
  timestamp?: string;
}

// ── Cross-domain response DTOs ──

export interface Correlation {
  id: string;
  type: 'OUTBREAK_CLIMATE' | 'TRADE_HEALTH' | 'LIVESTOCK_VACCINATION' | 'WILDLIFE_CRIME';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  countryCode: string;
  relatedEntities: string[];
  detectedAt: string;
}

export interface CorrelationsResponse {
  correlations: Correlation[];
  total: number;
  lastUpdated: string;
}

export interface RiskComponent {
  domain: string;
  score: number;
  weight: number;
  factors: string[];
}

export interface CountryRiskScore {
  countryCode: string;
  compositeScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  components: RiskComponent[];
  lastUpdated: string;
}

export interface LivestockPopulation {
  countryCode: string;
  totalPopulation: number;
  bySpecies: Record<string, number>;
  lastUpdated: string;
}

export interface FisheriesCatches {
  countryCode: string;
  totalCatchesKg: number;
  bySpecies: Record<string, number>;
  byMethod: Record<string, number>;
  lastUpdated: string;
}

export interface TradeBalance {
  countryCode: string;
  exports: number;
  imports: number;
  balance: number;
  topPartners: Array<{ country: string; value: number }>;
  lastUpdated: string;
}

export interface WildlifeCrimeTrends {
  countryCode: string;
  totalCrimes: number;
  byCrimeType: Record<string, number>;
  byProtectedArea: Record<string, number>;
  speciesAffected: number;
  lastUpdated: string;
}

export interface ClimateAlert {
  countryCode: string;
  activeHotspots: number;
  bySeverity: Record<string, number>;
  byType: Record<string, number>;
  lastUpdated: string;
}

export interface PvsScoreEntry {
  countryCode: string;
  latestScore: number;
  evaluationType: string;
  year: number;
  lastUpdated: string;
}

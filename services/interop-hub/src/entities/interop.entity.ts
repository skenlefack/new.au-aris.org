// ── Connector types ──

export type ConnectorType = 'WAHIS' | 'EMPRES' | 'FAOSTAT' | 'FISHSTATJ' | 'CITES';
export type InteropStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
export type ExportFormat = 'WOAH_JSON' | 'WOAH_XML' | 'EMPRES_JSON' | 'FAOSTAT_CSV' | 'FAOSTAT_JSON' | 'FISHSTATJ_CSV' | 'CITES_CSV';

// ── Entity interfaces ──

export interface ExportRecordEntity {
  id: string;
  tenantId: string;
  connectorType: ConnectorType;
  countryCode: string;
  periodStart: Date;
  periodEnd: Date;
  format: ExportFormat;
  status: InteropStatus;
  recordCount: number;
  packageUrl: string | null;
  packageSize: number | null;
  errorMessage: string | null;
  exportedBy: string;
  exportedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FeedRecordEntity {
  id: string;
  tenantId: string;
  connectorType: ConnectorType;
  healthEventId: string;
  diseaseId: string | null;
  countryCode: string;
  confidenceLevel: string;
  status: InteropStatus;
  payload: unknown;
  responseCode: number | null;
  responseBody: string | null;
  errorMessage: string | null;
  fedBy: string;
  fedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SyncRecordEntity {
  id: string;
  tenantId: string;
  connectorType: ConnectorType;
  countryCode: string;
  year: number;
  status: InteropStatus;
  recordsImported: number;
  recordsUpdated: number;
  discrepancies: number;
  discrepancyDetails: unknown;
  sourceUrl: string | null;
  syncedBy: string;
  syncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConnectorConfigEntity {
  id: string;
  connectorType: ConnectorType;
  name: string;
  description: string | null;
  baseUrl: string;
  isActive: boolean;
  lastHealthCheck: Date | null;
  lastHealthStatus: string | null;
  config: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConnectorHealth {
  connectorType: ConnectorType;
  name: string;
  isActive: boolean;
  status: string; // UP | DOWN | DEGRADED | UNKNOWN
  lastChecked: Date | null;
  baseUrl: string;
}

// ── WAHIS package types ──

export interface WahisEvent {
  eventId: string;
  diseaseCode: string;
  diseaseName: string;
  countryCode: string;
  reportDate: string;
  onsetDate: string | null;
  species: string[];
  cases: number;
  deaths: number;
  controlMeasures: string[];
  coordinates: { lat: number; lng: number } | null;
  confidenceLevel: string;
}

export interface WahisPackage {
  exportId: string;
  countryCode: string;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  format: string;
  events: WahisEvent[];
  totalEvents: number;
}

// ── EMPRES signal types ──

export interface EmpresSignal {
  signalId: string;
  eventId: string;
  diseaseCode: string;
  countryCode: string;
  reportDate: string;
  confidence: string;
  context: string;
  coordinates: { lat: number; lng: number } | null;
  species: string[];
  cases: number;
  deaths: number;
}

// ── FAOSTAT denominator types ──

export interface FaostatDenominator {
  countryCode: string;
  speciesCode: string;
  year: number;
  population: number;
  source: string;
}

export interface FaostatDiscrepancy {
  countryCode: string;
  speciesCode: string;
  year: number;
  existingValue: number;
  faostatValue: number;
  percentDiff: number;
}

// ── FishStatJ export types ──

export interface FishStatJRow {
  country: string;
  countryCode: string;
  isscaapGroup: string;
  speciesScientific: string;
  speciesFaoCode: string;
  faoArea: string;
  productionSource: 'C' | 'A'; // C = Capture, A = Aquaculture
  unit: string;
  year: number;
  quantity: number;
}

export interface FishStatJPackage {
  exportId: string;
  countryCode: string;
  year: number;
  generatedAt: string;
  format: string;
  rows: FishStatJRow[];
  totalRows: number;
}

// ── CITES export types ──

export interface CitesPermitRow {
  year: number;
  countryCode: string;
  speciesName: string;
  speciesCode: string;
  appendix: 'I' | 'II' | 'III';
  purpose: string; // T = Trade, S = Scientific, H = Hunting, P = Personal, etc.
  source: string;  // W = Wild, C = Captive-bred, R = Ranched, etc.
  originCountry: string;
  importCountry: string;
  quantity: number;
  unit: string;
  permitNumber: string;
}

export interface CitesPackage {
  exportId: string;
  countryCode: string;
  year: number;
  generatedAt: string;
  format: string;
  permits: CitesPermitRow[];
  totalPermits: number;
}

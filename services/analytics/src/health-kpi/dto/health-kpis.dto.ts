export interface HealthKpis {
  activeOutbreaks: number;
  confirmed: number;
  suspected: number;
  deaths: number;
  cases: number;
  vaccinationCoverage: number;
  avgLabTurnaround: number;
  qualityPassRate: number;
  lastUpdated: string;
}

export interface HealthKpisByDisease {
  countryCode: string;
  diseaseId: string;
  active: number;
  confirmed: number;
  cases: number;
  deaths: number;
  lastUpdated: string;
}

export interface HealthTrendEntry {
  timestamp: number;
  id: string;
  countryCode: string;
  diseaseId: string;
  cases: number;
  deaths: number;
  eventType: string;
}

export interface HealthTrends {
  period: string;
  entries: HealthTrendEntry[];
  totalEvents: number;
}

export interface QualityDashboard {
  passRate: number;
  failRate: number;
  totalRecords: number;
  passCount: number;
  failCount: number;
  lastUpdated: string;
}

export interface WorkflowTimeliness {
  levels: Record<string, { avgDays: number; count: number }>;
  lastUpdated: string;
}

export interface DenominatorEntry {
  countryCode: string;
  diseaseId: string;
  dosesUsed: number;
  targetPopulation: number;
  coverage: number;
  campaigns: number;
}

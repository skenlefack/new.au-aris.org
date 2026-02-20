export type QualityOverallStatus = 'PASSED' | 'FAILED' | 'WARNING';

export interface QualityReportEntity {
  id: string;
  recordId: string;
  entityType: string;
  domain: string;
  tenantId: string;
  overallStatus: QualityOverallStatus;
  totalDurationMs: number;
  checkedAt: Date;
  submittedBy: string | null;
  dataContractId: string | null;
  createdAt: Date;
  gateResults?: GateResultEntity[];
  violations?: ViolationEntity[];
}

export interface GateResultEntity {
  id: string;
  reportId: string;
  gate: string;
  status: string;
  durationMs: number;
}

export interface ViolationEntity {
  id: string;
  reportId: string;
  gate: string;
  field: string;
  message: string;
  severity: string;
}

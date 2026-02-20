import type { DataClassification } from '@aris/shared-types';

export type LabTestResult = 'POSITIVE' | 'NEGATIVE' | 'INCONCLUSIVE';

export interface LabResultEntity {
  id: string;
  tenantId: string;
  sampleId: string;
  sampleType: string;
  dateCollected: Date;
  dateReceived: Date;
  testType: string;
  result: LabTestResult;
  labId: string;
  turnaroundDays: number;
  eqaFlag: boolean;
  healthEventId: string | null;
  dataClassification: DataClassification;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

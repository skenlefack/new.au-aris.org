import type { DataClassification } from '@aris/shared-types';

export type SurveillanceType = 'PASSIVE' | 'ACTIVE' | 'SENTINEL' | 'EVENT_BASED';
export type DesignType = 'CLUSTER' | 'RISK_BASED' | 'RANDOM';

export interface SurveillanceEntity {
  id: string;
  tenantId: string;
  type: SurveillanceType;
  diseaseId: string;
  designType: DesignType | null;
  sampleSize: number;
  positivityRate: number | null;
  periodStart: Date;
  periodEnd: Date;
  geoEntityId: string;
  mapLayerId: string | null;
  dataClassification: DataClassification;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

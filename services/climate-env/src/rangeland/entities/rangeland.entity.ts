import type { DataClassification } from '@aris/shared-types';

export type DegradationLevel = 'NONE' | 'LIGHT' | 'MODERATE' | 'SEVERE';

export interface RangelandConditionEntity {
  id: string;
  tenantId: string;
  geoEntityId: string;
  assessmentDate: Date;
  ndviIndex: number;
  biomassTonsPerHa: number;
  degradationLevel: DegradationLevel;
  carryingCapacity: number;
  dataClassification: DataClassification;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

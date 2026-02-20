import type { DataClassification } from '@aris/shared-types';

export interface WaterStressIndexEntity {
  id: string;
  tenantId: string;
  geoEntityId: string;
  period: string;
  index: number;
  waterAvailability: string;
  irrigatedAreaPct: number;
  source: string;
  dataClassification: DataClassification;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

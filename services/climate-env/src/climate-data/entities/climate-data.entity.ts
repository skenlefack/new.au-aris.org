import type { DataClassification } from '@aris/shared-types';

export interface ClimateDataPointEntity {
  id: string;
  tenantId: string;
  geoEntityId: string;
  date: Date;
  temperature?: number;
  rainfall?: number;
  humidity?: number;
  windSpeed?: number;
  source: string;
  dataClassification: DataClassification;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

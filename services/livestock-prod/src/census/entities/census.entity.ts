import type { DataClassification } from '@aris/shared-types';

export interface LivestockCensusEntity {
  id: string;
  tenantId: string;
  geoEntityId: string;
  speciesId: string;
  year: number;
  population: number;
  methodology: string;
  source: string;
  dataClassification: DataClassification;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

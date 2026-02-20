import type { DataClassification } from '@aris/shared-types';

export interface TranshumanceCorridorEntity {
  id: string;
  tenantId: string;
  name: string;
  route: unknown;
  speciesId: string;
  seasonality: string;
  crossBorder: boolean;
  dataClassification: DataClassification;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

import type { DataClassification } from '@aris/shared-types';

export interface AquacultureProductionEntity {
  id: string;
  tenantId: string;
  farmId: string;
  speciesId: string;
  harvestDate: Date;
  quantityKg: number;
  methodOfCulture: string;
  feedUsedKg?: number;
  fcr?: number;
  batchId?: string;
  dataClassification: DataClassification;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

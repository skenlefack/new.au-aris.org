import type { DataClassification } from '@aris/shared-types';

export interface FishCaptureEntity {
  id: string;
  tenantId: string;
  geoEntityId: string;
  speciesId: string;
  faoAreaCode: string;
  vesselId?: string;
  captureDate: Date;
  quantityKg: number;
  gearType: string;
  landingSite: string;
  dataClassification: DataClassification;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

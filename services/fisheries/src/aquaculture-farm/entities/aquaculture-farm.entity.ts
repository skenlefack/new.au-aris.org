import type { DataClassification } from '@aris/shared-types';

export interface AquacultureFarmEntity {
  id: string;
  tenantId: string;
  name: string;
  geoEntityId: string;
  coordinates?: { lat: number; lng: number };
  farmType: string;
  waterSource: string;
  areaHectares: number;
  speciesIds: string[];
  productionCapacityTonnes: number;
  isActive: boolean;
  dataClassification: DataClassification;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

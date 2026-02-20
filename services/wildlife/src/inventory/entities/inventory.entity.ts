import type { DataClassification } from '@aris/shared-types';

export interface WildlifeInventoryEntity {
  id: string;
  tenantId: string;
  speciesId: string;
  geoEntityId: string;
  protectedAreaId?: string;
  surveyDate: Date;
  populationEstimate: number;
  methodology: string;
  confidenceInterval?: string;
  conservationStatus: string;
  threatLevel: string;
  coordinates?: { lat: number; lng: number };
  dataClassification: DataClassification;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

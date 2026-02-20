import type { DataClassification } from '@aris/shared-types';

export type HotspotType = 'DEFORESTATION' | 'DESERTIFICATION' | 'FLOODING' | 'DROUGHT' | 'POLLUTION';
export type HotspotSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface EnvironmentalHotspotEntity {
  id: string;
  tenantId: string;
  geoEntityId: string;
  type: HotspotType;
  severity: HotspotSeverity;
  detectedDate: Date;
  satelliteSource?: string;
  affectedSpecies: string[];
  dataClassification: DataClassification;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

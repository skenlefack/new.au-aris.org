import type { DataClassification } from '@aris/shared-types';

export interface WildlifeCrimeEntity {
  id: string;
  tenantId: string;
  incidentDate: Date;
  geoEntityId: string;
  coordinates?: { lat: number; lng: number };
  crimeType: string;
  speciesIds: string[];
  description: string;
  suspectsCount?: number;
  seizureDescription?: string;
  seizureQuantity?: number;
  seizureUnit?: string;
  status: string;
  reportingAgency: string;
  dataClassification: DataClassification;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

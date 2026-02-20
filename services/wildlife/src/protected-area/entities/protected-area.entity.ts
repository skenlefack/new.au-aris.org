import type { DataClassification } from '@aris/shared-types';

export interface ProtectedAreaEntity {
  id: string;
  tenantId: string;
  name: string;
  wdpaId?: string;
  iucnCategory: string;
  geoEntityId: string;
  areaKm2: number;
  designationDate?: Date;
  managingAuthority: string;
  coordinates?: { lat: number; lng: number };
  isActive: boolean;
  dataClassification: DataClassification;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

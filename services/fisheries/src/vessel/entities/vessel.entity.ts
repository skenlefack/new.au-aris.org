import type { DataClassification } from '@aris/shared-types';

export interface FishingVesselEntity {
  id: string;
  tenantId: string;
  name: string;
  registrationNumber: string;
  flagState: string;
  vesselType: string;
  lengthMeters: number;
  tonnageGt: number;
  homePort: string;
  licenseNumber?: string;
  licenseExpiry?: Date;
  isActive: boolean;
  dataClassification: DataClassification;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

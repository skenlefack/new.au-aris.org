import type { DataClassification } from '@aris/shared-types';

export interface CapacityEntity {
  id: string;
  tenantId: string;
  year: number;
  epiStaff: number;
  labStaff: number;
  labTestsAvailable: string[];
  vaccineProductionCapacity: number | null;
  pvsScore: number | null;
  dataClassification: DataClassification;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

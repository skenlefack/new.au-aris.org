import type { DataClassification } from '@aris/shared-types';

export interface VaccinationEntity {
  id: string;
  tenantId: string;
  diseaseId: string;
  speciesId: string;
  vaccineType: string;
  vaccineBatch: string | null;
  dosesDelivered: number;
  dosesUsed: number;
  targetPopulation: number;
  coverageEstimate: number;
  pveSerologyDone: boolean;
  periodStart: Date;
  periodEnd: Date;
  geoEntityId: string;
  dataClassification: DataClassification;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

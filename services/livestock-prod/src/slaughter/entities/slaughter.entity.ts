import type { DataClassification } from '@aris/shared-types';

export interface SlaughterRecordEntity {
  id: string;
  tenantId: string;
  speciesId: string;
  facilityId: string;
  count: number;
  condemnations: number;
  periodStart: Date;
  periodEnd: Date;
  geoEntityId: string;
  dataClassification: DataClassification;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

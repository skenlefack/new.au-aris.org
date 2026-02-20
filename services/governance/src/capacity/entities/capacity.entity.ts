import type { DataClassification } from '@aris/shared-types';

export interface InstitutionalCapacityEntity {
  id: string;
  tenantId: string;
  year: number;
  organizationName: string;
  staffCount: number;
  budgetUsd: number;
  pvsSelfAssessmentScore: number | null;
  oieStatus: string | null;
  dataClassification: DataClassification;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

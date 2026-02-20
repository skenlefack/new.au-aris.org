import type { DataClassification } from '@aris/shared-types';

export interface CITESPermitEntity {
  id: string;
  tenantId: string;
  permitNumber: string;
  permitType: string;
  speciesId: string;
  quantity: number;
  unit: string;
  purpose: string;
  applicant: string;
  exportCountry: string;
  importCountry: string;
  issueDate: Date;
  expiryDate: Date;
  status: string;
  dataClassification: DataClassification;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

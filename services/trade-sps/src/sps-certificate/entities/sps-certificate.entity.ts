import type { DataClassification } from '@aris/shared-types';

export type InspectionResult = 'PASS' | 'FAIL' | 'CONDITIONAL' | 'PENDING';
export type CertificateStatus = 'DRAFT' | 'ISSUED' | 'REVOKED' | 'EXPIRED';

export interface SpsCertificateEntity {
  id: string;
  tenantId: string;
  certificateNumber: string;
  consignmentId: string;
  exporterId: string;
  importerId: string;
  speciesId: string;
  commodity: string;
  quantity: number;
  unit: string;
  originCountryId: string;
  destinationCountryId: string;
  inspectionResult: InspectionResult;
  inspectionDate: Date;
  certifiedBy: string;
  certifiedAt: Date | null;
  status: CertificateStatus;
  validUntil: Date | null;
  remarks: string | null;
  dataClassification: DataClassification;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

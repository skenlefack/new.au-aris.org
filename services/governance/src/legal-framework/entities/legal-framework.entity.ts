import type { DataClassification } from '@aris/shared-types';

export enum FrameworkType {
  LAW = 'LAW',
  REGULATION = 'REGULATION',
  POLICY = 'POLICY',
  STANDARD = 'STANDARD',
  GUIDELINE = 'GUIDELINE',
}

export enum FrameworkStatus {
  DRAFT = 'DRAFT',
  ADOPTED = 'ADOPTED',
  IN_FORCE = 'IN_FORCE',
  REPEALED = 'REPEALED',
}

export interface LegalFrameworkEntity {
  id: string;
  tenantId: string;
  title: string;
  type: FrameworkType;
  domain: string;
  adoptionDate: Date | null;
  status: FrameworkStatus;
  documentFileId: string | null;
  dataClassification: DataClassification;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

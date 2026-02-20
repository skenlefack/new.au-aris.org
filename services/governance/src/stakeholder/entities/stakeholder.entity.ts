import type { DataClassification } from '@aris/shared-types';

export enum StakeholderType {
  GOVERNMENT = 'GOVERNMENT',
  NGO = 'NGO',
  PRIVATE = 'PRIVATE',
  ACADEMIC = 'ACADEMIC',
  INTERNATIONAL = 'INTERNATIONAL',
}

export interface StakeholderRegistryEntity {
  id: string;
  tenantId: string;
  name: string;
  type: StakeholderType;
  contactPerson: string | null;
  email: string | null;
  domains: string[];
  dataClassification: DataClassification;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

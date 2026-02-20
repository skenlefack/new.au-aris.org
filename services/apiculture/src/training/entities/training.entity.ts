import type { DataClassification } from '@aris/shared-types';

export interface BeekeeperTrainingEntity {
  id: string;
  tenantId: string;
  beekeeperId: string;
  trainingType: string;
  completedDate: Date;
  certificationNumber?: string | null;
  dataClassification: DataClassification;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

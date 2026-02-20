import type { DataClassification } from '@aris/shared-types';

export type HoneyQuality = 'GRADE_A' | 'GRADE_B' | 'GRADE_C';

export interface HoneyProductionEntity {
  id: string;
  tenantId: string;
  apiaryId: string;
  harvestDate: Date;
  quantity: number;
  unit: string;
  quality: HoneyQuality;
  floralSource: string;
  dataClassification: DataClassification;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

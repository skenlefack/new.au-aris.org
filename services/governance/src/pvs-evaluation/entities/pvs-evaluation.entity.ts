import type { DataClassification } from '@aris/shared-types';

export enum PVSEvaluationType {
  PVS = 'PVS',
  PVS_GAP = 'PVS_GAP',
  PVS_FOLLOW_UP = 'PVS_FOLLOW_UP',
}

export interface PVSEvaluationEntity {
  id: string;
  tenantId: string;
  evaluationType: PVSEvaluationType;
  evaluationDate: Date;
  overallScore: number;
  criticalCompetencies: Record<string, unknown>;
  recommendations: string[];
  dataClassification: DataClassification;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

import type { DataClassification } from '@aris/shared-types';

export type ColonyStrength = 'STRONG' | 'MEDIUM' | 'WEAK' | 'DEAD';
export type BeeDisease = 'VARROA' | 'AFB' | 'EFB' | 'NOSEMA' | 'NONE';

export interface ColonyHealthEntity {
  id: string;
  tenantId: string;
  apiaryId: string;
  inspectionDate: Date;
  colonyStrength: ColonyStrength;
  diseases: BeeDisease[];
  treatments: string[];
  dataClassification: DataClassification;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

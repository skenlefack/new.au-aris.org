import type { DataClassification } from '@aris/shared-types';

export type HiveType = 'LANGSTROTH' | 'TOP_BAR' | 'KENYAN_TOP_BAR' | 'TRADITIONAL';

export interface ApiaryEntity {
  id: string;
  tenantId: string;
  name: string;
  geoEntityId: string;
  latitude?: number | null;
  longitude?: number | null;
  hiveCount: number;
  hiveType: HiveType;
  ownerName: string;
  dataClassification: DataClassification;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

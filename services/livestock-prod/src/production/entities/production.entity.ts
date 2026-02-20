import type { DataClassification } from '@aris/shared-types';

export type ProductType = 'MEAT' | 'MILK' | 'EGGS' | 'WOOL' | 'HIDE';

export interface ProductionRecordEntity {
  id: string;
  tenantId: string;
  speciesId: string;
  productType: ProductType;
  quantity: number;
  unit: string;
  periodStart: Date;
  periodEnd: Date;
  geoEntityId: string;
  dataClassification: DataClassification;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

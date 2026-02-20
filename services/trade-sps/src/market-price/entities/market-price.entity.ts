import type { DataClassification } from '@aris/shared-types';

export type PriceType = 'WHOLESALE' | 'RETAIL' | 'FARM_GATE' | 'EXPORT';

export interface MarketPriceEntity {
  id: string;
  tenantId: string;
  marketId: string;
  speciesId: string;
  commodity: string;
  priceType: PriceType;
  price: number;
  currency: string;
  unit: string;
  date: Date;
  source: string | null;
  dataClassification: DataClassification;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

import type { DataClassification } from '@aris/shared-types';

export type FlowDirection = 'IMPORT' | 'EXPORT' | 'TRANSIT';

export interface TradeFlowEntity {
  id: string;
  tenantId: string;
  exportCountryId: string;
  importCountryId: string;
  speciesId: string;
  commodity: string;
  flowDirection: FlowDirection;
  quantity: number;
  unit: string;
  valueFob: number | null;
  currency: string;
  periodStart: Date;
  periodEnd: Date;
  hsCode: string | null;
  spsStatus: string | null;
  dataClassification: DataClassification;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

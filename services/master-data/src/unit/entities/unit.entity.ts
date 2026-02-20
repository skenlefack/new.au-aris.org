export type UnitCategory = 'COUNT' | 'WEIGHT' | 'VOLUME' | 'AREA' | 'LENGTH' | 'DOSE' | 'CURRENCY' | 'PROPORTION' | 'TIME';

export interface UnitRecord {
  id: string;
  code: string;
  nameEn: string;
  nameFr: string;
  symbol: string;
  category: UnitCategory;
  siConversion: number | null;
  isActive: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

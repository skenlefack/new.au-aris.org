export type DenominatorSource = 'FAOSTAT' | 'NATIONAL_CENSUS' | 'ESTIMATE';

export interface DenominatorRecord {
  id: string;
  countryCode: string;
  geoEntityId: string | null;
  speciesId: string;
  year: number;
  source: DenominatorSource;
  population: bigint;
  assumptions: string | null;
  validatedAt: Date | null;
  validatedBy: string | null;
  isActive: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export type IdentifierType = 'LAB' | 'MARKET' | 'BORDER_POINT' | 'PROTECTED_AREA' | 'SLAUGHTERHOUSE' | 'QUARANTINE_STATION';

export interface IdentifierRecord {
  id: string;
  code: string;
  nameEn: string;
  nameFr: string;
  type: IdentifierType;
  geoEntityId: string | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  contactInfo: unknown;
  isActive: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

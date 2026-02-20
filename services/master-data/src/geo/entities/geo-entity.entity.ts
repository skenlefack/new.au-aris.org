export type GeoLevel = 'COUNTRY' | 'ADMIN1' | 'ADMIN2' | 'ADMIN3' | 'SPECIAL_ZONE';

export interface GeoEntityRecord {
  id: string;
  code: string;
  name: string;
  nameEn: string;
  nameFr: string;
  level: GeoLevel;
  parentId: string | null;
  countryCode: string;
  centroidLat: number | null;
  centroidLng: number | null;
  isActive: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface GeoEntityWithGeometry extends GeoEntityRecord {
  geometry?: GeoJSON.Geometry | null;
}

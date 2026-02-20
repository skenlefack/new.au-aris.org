// ── GeoJSON RFC 7946 types ──

export interface GeoJsonGeometry {
  type: 'Point' | 'MultiPoint' | 'LineString' | 'MultiLineString' | 'Polygon' | 'MultiPolygon';
  coordinates: unknown;
}

export interface GeoJsonFeature<P = Record<string, unknown>> {
  type: 'Feature';
  geometry: GeoJsonGeometry;
  properties: P;
}

export interface GeoJsonFeatureCollection<P = Record<string, unknown>> {
  type: 'FeatureCollection';
  features: GeoJsonFeature<P>[];
}

// ── Map Layer entity ──

export type LayerType = 'BOUNDARY' | 'RISK' | 'FACILITY' | 'CORRIDOR' | 'HEATMAP';

export interface MapLayerEntity {
  id: string;
  name: string;
  description: string | null;
  layerType: LayerType;
  sourceTable: string;
  geometryType: string;
  style: unknown;
  minZoom: number;
  maxZoom: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

// ── Admin boundary entity ──

export interface AdminBoundaryEntity {
  id: string;
  code: string;
  name: string;
  nameEn: string;
  nameFr: string;
  level: string;
  parentCode: string | null;
  countryCode: string;
  centroidLat: number | null;
  centroidLng: number | null;
  properties: unknown;
  createdAt: Date;
  updatedAt: Date;
}

// ── Spatial query result types ──

export interface SpatialEntity {
  id: string;
  code: string;
  name: string;
  level: string;
  countryCode: string;
  centroidLat: number | null;
  centroidLng: number | null;
  distance?: number; // meters, for nearest queries
  geojson: string;   // GeoJSON geometry string from ST_AsGeoJSON
}

export interface ContainsResult {
  code: string;
  name: string;
  level: string;
  countryCode: string;
}

// ── Risk map types ──

export type SeverityLevel = 'NONE' | 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export interface RiskZoneProperties {
  code: string;
  name: string;
  countryCode: string;
  eventCount: number;
  severity: SeverityLevel;
}

// ── Severity classification thresholds ──

export const SEVERITY_THRESHOLDS: { max: number; level: SeverityLevel }[] = [
  { max: 0, level: 'NONE' },
  { max: 5, level: 'LOW' },
  { max: 20, level: 'MODERATE' },
  { max: 50, level: 'HIGH' },
];

export function classifySeverity(eventCount: number): SeverityLevel {
  for (const threshold of SEVERITY_THRESHOLDS) {
    if (eventCount <= threshold.max) {
      return threshold.level;
    }
  }
  return 'CRITICAL';
}

// ── Cache TTL constants (seconds) ──

export const CACHE_TTL_RISK_MAP = 300;      // 5 minutes
export const CACHE_TTL_BOUNDARY = 3600;     // 1 hour
export const CACHE_TTL_LAYERS = 3600;       // 1 hour
export const CACHE_TTL_WITHIN = 300;        // 5 minutes
export const CACHE_TTL_NEAREST = 300;       // 5 minutes
export const CACHE_TTL_CONTAINS = 3600;     // 1 hour

// ── Helper: build GeoJSON Feature from raw PostGIS row ──

export function buildFeature<P>(
  geojsonStr: string,
  properties: P,
): GeoJsonFeature<P> {
  return {
    type: 'Feature',
    geometry: JSON.parse(geojsonStr) as GeoJsonGeometry,
    properties,
  };
}

export function buildFeatureCollection<P>(
  features: GeoJsonFeature<P>[],
): GeoJsonFeatureCollection<P> {
  return {
    type: 'FeatureCollection',
    features,
  };
}

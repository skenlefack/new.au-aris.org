import type { GeoJsonGeometry } from '../geo/entities/geo.entity';

// ── Enums ──

export type RiskLayerType = 'DISEASE_RISK' | 'CLIMATE' | 'TRADE_CORRIDOR' | 'WILDLIFE_HABITAT';
export type RiskSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type DataClassification = 'PUBLIC' | 'PARTNER' | 'RESTRICTED' | 'CONFIDENTIAL';

// ── Inputs ──

export interface RiskLayerInput {
  name: string;
  description?: string;
  layerType: RiskLayerType;
  severity: RiskSeverity;
  geometry: GeoJsonGeometry;
  properties?: Record<string, unknown>;
  dataClassification?: DataClassification;
  validFrom?: string;
  validUntil?: string;
  source?: string;
}

export interface RiskLayerUpdate {
  name?: string;
  description?: string;
  layerType?: RiskLayerType;
  severity?: RiskSeverity;
  geometry?: GeoJsonGeometry;
  properties?: Record<string, unknown>;
  dataClassification?: DataClassification;
  validFrom?: string | null;
  validUntil?: string | null;
  source?: string | null;
  isActive?: boolean;
}

// ── Response ──

export interface RiskLayerResponse {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  layerType: RiskLayerType;
  severity: RiskSeverity;
  geometry: GeoJsonGeometry | null;
  properties: Record<string, unknown>;
  dataClassification: string;
  validFrom: string | null;
  validUntil: string | null;
  source: string | null;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Query ──

export interface BboxQuery {
  west: number;
  south: number;
  east: number;
  north: number;
  layerType?: RiskLayerType;
  severity?: RiskSeverity;
}

export interface RiskLayerFilters {
  layerType?: RiskLayerType;
  severity?: RiskSeverity;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

// ── Spatial Analysis ──

export interface SpatialAnalysisQuery {
  point: { lat: number; lng: number };
  radiusKm: number;
  layerTypes?: RiskLayerType[];
}

export interface SpatialAnalysisResult {
  riskLayers: RiskLayerResponse[];
  nearbyEvents: Array<{
    id: string;
    entityType: string;
    entityId: string;
    latitude: number;
    longitude: number;
    occurredAt: string;
    properties: Record<string, unknown>;
    distanceMeters: number;
  }>;
  bufferZone: GeoJsonGeometry;
}

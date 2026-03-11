import { Type, type Static } from '@sinclair/typebox';

// ── Shared enums ──

const RiskLayerTypeEnum = Type.Union([
  Type.Literal('DISEASE_RISK'),
  Type.Literal('CLIMATE'),
  Type.Literal('TRADE_CORRIDOR'),
  Type.Literal('WILDLIFE_HABITAT'),
]);

const RiskSeverityEnum = Type.Union([
  Type.Literal('LOW'),
  Type.Literal('MEDIUM'),
  Type.Literal('HIGH'),
  Type.Literal('CRITICAL'),
]);

const DataClassificationEnum = Type.Union([
  Type.Literal('PUBLIC'),
  Type.Literal('PARTNER'),
  Type.Literal('RESTRICTED'),
  Type.Literal('CONFIDENTIAL'),
]);

const GeoJsonGeometrySchema = Type.Object({
  type: Type.String(),
  coordinates: Type.Unknown(),
});

// ── Create ──

export const CreateRiskLayerSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 255 }),
  description: Type.Optional(Type.String()),
  layerType: RiskLayerTypeEnum,
  severity: RiskSeverityEnum,
  geometry: GeoJsonGeometrySchema,
  properties: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  dataClassification: Type.Optional(DataClassificationEnum),
  validFrom: Type.Optional(Type.String()),
  validUntil: Type.Optional(Type.String()),
  source: Type.Optional(Type.String({ maxLength: 255 })),
});

export type CreateRiskLayerInput = Static<typeof CreateRiskLayerSchema>;

// ── Update ──

export const UpdateRiskLayerSchema = Type.Object({
  name: Type.Optional(Type.String({ minLength: 1, maxLength: 255 })),
  description: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  layerType: Type.Optional(RiskLayerTypeEnum),
  severity: Type.Optional(RiskSeverityEnum),
  geometry: Type.Optional(GeoJsonGeometrySchema),
  properties: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  dataClassification: Type.Optional(DataClassificationEnum),
  validFrom: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  validUntil: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  source: Type.Optional(Type.Union([Type.String({ maxLength: 255 }), Type.Null()])),
  isActive: Type.Optional(Type.Boolean()),
});

export type UpdateRiskLayerInput = Static<typeof UpdateRiskLayerSchema>;

// ── Bbox Query ──

export const RiskLayerBboxQuerySchema = Type.Object({
  west: Type.Number({ minimum: -180, maximum: 180 }),
  south: Type.Number({ minimum: -90, maximum: 90 }),
  east: Type.Number({ minimum: -180, maximum: 180 }),
  north: Type.Number({ minimum: -90, maximum: 90 }),
  layerType: Type.Optional(RiskLayerTypeEnum),
  severity: Type.Optional(RiskSeverityEnum),
});

export type RiskLayerBboxQueryInput = Static<typeof RiskLayerBboxQuerySchema>;

// ── List Query ──

export const RiskLayerListQuerySchema = Type.Object({
  layerType: Type.Optional(RiskLayerTypeEnum),
  severity: Type.Optional(RiskSeverityEnum),
  isActive: Type.Optional(Type.Boolean()),
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
});

export type RiskLayerListQueryInput = Static<typeof RiskLayerListQuerySchema>;

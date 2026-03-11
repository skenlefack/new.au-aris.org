import { Type, type Static } from '@sinclair/typebox';

// ── Query: Within (bounding box) ──

export const WithinQuerySchema = Type.Object({
  minLng: Type.Number({ minimum: -180, maximum: 180 }),
  minLat: Type.Number({ minimum: -90, maximum: 90 }),
  maxLng: Type.Number({ minimum: -180, maximum: 180 }),
  maxLat: Type.Number({ minimum: -90, maximum: 90 }),
  level: Type.Optional(Type.String()),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 500 })),
});

export type WithinQueryInput = Static<typeof WithinQuerySchema>;

// ── Query: Nearest ──

export const NearestQuerySchema = Type.Object({
  lat: Type.Number({ minimum: -90, maximum: 90 }),
  lng: Type.Number({ minimum: -180, maximum: 180 }),
  level: Type.Optional(Type.String()),
  maxDistance: Type.Optional(Type.Number({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
});

export type NearestQueryInput = Static<typeof NearestQuerySchema>;

// ── Query: Contains (reverse geocode) ──

export const ContainsQuerySchema = Type.Object({
  lat: Type.Number({ minimum: -90, maximum: 90 }),
  lng: Type.Number({ minimum: -180, maximum: 180 }),
});

export type ContainsQueryInput = Static<typeof ContainsQuerySchema>;

// ── Query: Risk Map ──

export const RiskMapQuerySchema = Type.Object({
  diseaseId: Type.String({ format: 'uuid' }),
  periodStart: Type.String(),
  periodEnd: Type.String(),
  countryCode: Type.Optional(Type.String()),
  adminLevel: Type.Optional(Type.Union([
    Type.Literal('ADMIN1'),
    Type.Literal('ADMIN2'),
  ])),
});

export type RiskMapQueryInput = Static<typeof RiskMapQuerySchema>;

// ── Query: Spatial Analysis ──

export const SpatialAnalysisQuerySchema = Type.Object({
  point: Type.Object({
    lat: Type.Number({ minimum: -90, maximum: 90 }),
    lng: Type.Number({ minimum: -180, maximum: 180 }),
  }),
  radiusKm: Type.Number({ minimum: 0.1, maximum: 500 }),
  layerTypes: Type.Optional(Type.Array(
    Type.Union([
      Type.Literal('DISEASE_RISK'),
      Type.Literal('CLIMATE'),
      Type.Literal('TRADE_CORRIDOR'),
      Type.Literal('WILDLIFE_HABITAT'),
    ]),
  )),
});

export type SpatialAnalysisQueryInput = Static<typeof SpatialAnalysisQuerySchema>;

// ── Params: Tile proxy ──

export const TileParamsSchema = Type.Object({
  layer: Type.String(),
  z: Type.Integer({ minimum: 0, maximum: 22 }),
  x: Type.Integer({ minimum: 0 }),
  y: Type.Integer({ minimum: 0 }),
});

export type TileParamsInput = Static<typeof TileParamsSchema>;

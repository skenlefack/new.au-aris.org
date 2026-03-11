import { Type, type Static } from '@sinclair/typebox';

export const CreateHotspotSchema = Type.Object({
  geoEntityId: Type.String({ format: 'uuid' }),
  type: Type.String({ minLength: 1, maxLength: 100 }),
  severity: Type.String({ minLength: 1, maxLength: 50 }),
  detectedDate: Type.String({ format: 'date-time' }),
  satelliteSource: Type.String({ minLength: 1, maxLength: 255 }),
  affectedSpecies: Type.Array(Type.String(), { minItems: 0 }),
  dataClassification: Type.Optional(Type.String()),
});

export const UpdateHotspotSchema = Type.Object({
  geoEntityId: Type.Optional(Type.String({ format: 'uuid' })),
  type: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
  severity: Type.Optional(Type.String({ minLength: 1, maxLength: 50 })),
  detectedDate: Type.Optional(Type.String({ format: 'date-time' })),
  satelliteSource: Type.Optional(Type.String({ minLength: 1, maxLength: 255 })),
  affectedSpecies: Type.Optional(Type.Array(Type.String())),
  dataClassification: Type.Optional(Type.String()),
});

export const HotspotFilterSchema = Type.Object({
  geoEntityId: Type.Optional(Type.String({ format: 'uuid' })),
  type: Type.Optional(Type.String()),
  severity: Type.Optional(Type.String()),
  periodStart: Type.Optional(Type.String({ format: 'date-time' })),
  periodEnd: Type.Optional(Type.String({ format: 'date-time' })),
});

export const PaginationQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  sort: Type.Optional(Type.String()),
  order: Type.Optional(Type.Union([Type.Literal('asc'), Type.Literal('desc')])),
});

export const UuidParamSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
});

export type CreateHotspotInput = Static<typeof CreateHotspotSchema>;
export type UpdateHotspotInput = Static<typeof UpdateHotspotSchema>;
export type HotspotFilterInput = Static<typeof HotspotFilterSchema>;
export type PaginationQueryInput = Static<typeof PaginationQuerySchema>;
export type UuidParamInput = Static<typeof UuidParamSchema>;

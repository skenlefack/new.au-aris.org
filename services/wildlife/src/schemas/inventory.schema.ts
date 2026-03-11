import { Type, type Static } from '@sinclair/typebox';

export const CreateInventorySchema = Type.Object({
  speciesId: Type.String({ format: 'uuid' }),
  geoEntityId: Type.String({ format: 'uuid' }),
  protectedAreaId: Type.Optional(Type.String({ format: 'uuid' })),
  surveyDate: Type.String({ format: 'date-time' }),
  populationEstimate: Type.Integer({ minimum: 0 }),
  methodology: Type.String({ minLength: 1, maxLength: 255 }),
  confidenceInterval: Type.Optional(Type.String({ maxLength: 100 })),
  conservationStatus: Type.String({ minLength: 1, maxLength: 50 }),
  threatLevel: Type.String({ minLength: 1, maxLength: 50 }),
  coordinates: Type.Optional(Type.Unknown()),
  dataClassification: Type.Optional(Type.String()),
});

export const UpdateInventorySchema = Type.Object({
  speciesId: Type.Optional(Type.String({ format: 'uuid' })),
  geoEntityId: Type.Optional(Type.String({ format: 'uuid' })),
  protectedAreaId: Type.Optional(Type.String({ format: 'uuid' })),
  surveyDate: Type.Optional(Type.String({ format: 'date-time' })),
  populationEstimate: Type.Optional(Type.Integer({ minimum: 0 })),
  methodology: Type.Optional(Type.String({ minLength: 1, maxLength: 255 })),
  confidenceInterval: Type.Optional(Type.String({ maxLength: 100 })),
  conservationStatus: Type.Optional(Type.String({ minLength: 1, maxLength: 50 })),
  threatLevel: Type.Optional(Type.String({ minLength: 1, maxLength: 50 })),
  coordinates: Type.Optional(Type.Unknown()),
  dataClassification: Type.Optional(Type.String()),
});

export const InventoryFilterSchema = Type.Object({
  speciesId: Type.Optional(Type.String({ format: 'uuid' })),
  geoEntityId: Type.Optional(Type.String({ format: 'uuid' })),
  protectedAreaId: Type.Optional(Type.String({ format: 'uuid' })),
  conservationStatus: Type.Optional(Type.String()),
  threatLevel: Type.Optional(Type.String()),
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

export type CreateInventoryInput = Static<typeof CreateInventorySchema>;
export type UpdateInventoryInput = Static<typeof UpdateInventorySchema>;
export type InventoryFilterInput = Static<typeof InventoryFilterSchema>;
export type PaginationQueryInput = Static<typeof PaginationQuerySchema>;
export type UuidParamInput = Static<typeof UuidParamSchema>;

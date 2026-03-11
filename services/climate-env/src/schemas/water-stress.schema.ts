import { Type, type Static } from '@sinclair/typebox';

export const CreateWaterStressSchema = Type.Object({
  geoEntityId: Type.String({ format: 'uuid' }),
  period: Type.String({ minLength: 1, maxLength: 50 }),
  index: Type.Number({ minimum: 0 }),
  waterAvailability: Type.String({ minLength: 1, maxLength: 100 }),
  irrigatedAreaPct: Type.Number({ minimum: 0, maximum: 100 }),
  source: Type.String({ minLength: 1, maxLength: 255 }),
  dataClassification: Type.Optional(Type.String()),
});

export const UpdateWaterStressSchema = Type.Object({
  geoEntityId: Type.Optional(Type.String({ format: 'uuid' })),
  period: Type.Optional(Type.String({ minLength: 1, maxLength: 50 })),
  index: Type.Optional(Type.Number({ minimum: 0 })),
  waterAvailability: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
  irrigatedAreaPct: Type.Optional(Type.Number({ minimum: 0, maximum: 100 })),
  source: Type.Optional(Type.String({ minLength: 1, maxLength: 255 })),
  dataClassification: Type.Optional(Type.String()),
});

export const WaterStressFilterSchema = Type.Object({
  geoEntityId: Type.Optional(Type.String({ format: 'uuid' })),
  period: Type.Optional(Type.String()),
  minIndex: Type.Optional(Type.Number()),
  maxIndex: Type.Optional(Type.Number()),
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

export type CreateWaterStressInput = Static<typeof CreateWaterStressSchema>;
export type UpdateWaterStressInput = Static<typeof UpdateWaterStressSchema>;
export type WaterStressFilterInput = Static<typeof WaterStressFilterSchema>;
export type PaginationQueryInput = Static<typeof PaginationQuerySchema>;
export type UuidParamInput = Static<typeof UuidParamSchema>;

import { Type, type Static } from '@sinclair/typebox';

export const CreateClimateDataSchema = Type.Object({
  geoEntityId: Type.String({ format: 'uuid' }),
  date: Type.String({ format: 'date-time' }),
  temperature: Type.Number(),
  rainfall: Type.Number({ minimum: 0 }),
  humidity: Type.Number({ minimum: 0, maximum: 100 }),
  windSpeed: Type.Number({ minimum: 0 }),
  source: Type.String({ minLength: 1, maxLength: 255 }),
  dataClassification: Type.Optional(Type.String()),
});

export const UpdateClimateDataSchema = Type.Object({
  geoEntityId: Type.Optional(Type.String({ format: 'uuid' })),
  date: Type.Optional(Type.String({ format: 'date-time' })),
  temperature: Type.Optional(Type.Number()),
  rainfall: Type.Optional(Type.Number({ minimum: 0 })),
  humidity: Type.Optional(Type.Number({ minimum: 0, maximum: 100 })),
  windSpeed: Type.Optional(Type.Number({ minimum: 0 })),
  source: Type.Optional(Type.String({ minLength: 1, maxLength: 255 })),
  dataClassification: Type.Optional(Type.String()),
});

export const ClimateDataFilterSchema = Type.Object({
  geoEntityId: Type.Optional(Type.String({ format: 'uuid' })),
  source: Type.Optional(Type.String()),
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

export type CreateClimateDataInput = Static<typeof CreateClimateDataSchema>;
export type UpdateClimateDataInput = Static<typeof UpdateClimateDataSchema>;
export type ClimateDataFilterInput = Static<typeof ClimateDataFilterSchema>;
export type PaginationQueryInput = Static<typeof PaginationQuerySchema>;
export type UuidParamInput = Static<typeof UuidParamSchema>;

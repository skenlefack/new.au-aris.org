import { Type, type Static } from '@sinclair/typebox';

export const CreateRangelandSchema = Type.Object({
  geoEntityId: Type.String({ format: 'uuid' }),
  assessmentDate: Type.String({ format: 'date-time' }),
  ndviIndex: Type.Number({ minimum: -1, maximum: 1 }),
  biomassTonsPerHa: Type.Number({ minimum: 0 }),
  degradationLevel: Type.String({ minLength: 1, maxLength: 50 }),
  carryingCapacity: Type.Number({ minimum: 0 }),
  dataClassification: Type.Optional(Type.String()),
});

export const UpdateRangelandSchema = Type.Object({
  geoEntityId: Type.Optional(Type.String({ format: 'uuid' })),
  assessmentDate: Type.Optional(Type.String({ format: 'date-time' })),
  ndviIndex: Type.Optional(Type.Number({ minimum: -1, maximum: 1 })),
  biomassTonsPerHa: Type.Optional(Type.Number({ minimum: 0 })),
  degradationLevel: Type.Optional(Type.String({ minLength: 1, maxLength: 50 })),
  carryingCapacity: Type.Optional(Type.Number({ minimum: 0 })),
  dataClassification: Type.Optional(Type.String()),
});

export const RangelandFilterSchema = Type.Object({
  geoEntityId: Type.Optional(Type.String({ format: 'uuid' })),
  degradationLevel: Type.Optional(Type.String()),
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

export type CreateRangelandInput = Static<typeof CreateRangelandSchema>;
export type UpdateRangelandInput = Static<typeof UpdateRangelandSchema>;
export type RangelandFilterInput = Static<typeof RangelandFilterSchema>;
export type PaginationQueryInput = Static<typeof PaginationQuerySchema>;
export type UuidParamInput = Static<typeof UuidParamSchema>;

import { Type, type Static } from '@sinclair/typebox';

export const CreateEffortSchema = Type.Object({
  effortType: Type.String({ minLength: 1, maxLength: 100 }),
  effortValue: Type.Number({ minimum: 0 }),
  effortUnit: Type.String({ minLength: 1, maxLength: 50 }),
  startDate: Type.Optional(Type.String({ format: 'date-time' })),
  endDate: Type.Optional(Type.String({ format: 'date-time' })),
  gearType: Type.String({ minLength: 1, maxLength: 100 }),
  vesselId: Type.Optional(Type.String({ format: 'uuid' })),
  captureId: Type.Optional(Type.String({ format: 'uuid' })),
  crewSize: Type.Optional(Type.Integer({ minimum: 0 })),
  faoAreaCode: Type.Optional(Type.String({ maxLength: 20 })),
  dataClassification: Type.Optional(Type.String()),
});

export const UpdateEffortSchema = Type.Object({
  effortType: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
  effortValue: Type.Optional(Type.Number({ minimum: 0 })),
  effortUnit: Type.Optional(Type.String({ minLength: 1, maxLength: 50 })),
  startDate: Type.Optional(Type.String({ format: 'date-time' })),
  endDate: Type.Optional(Type.String({ format: 'date-time' })),
  gearType: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
  vesselId: Type.Optional(Type.String({ format: 'uuid' })),
  captureId: Type.Optional(Type.String({ format: 'uuid' })),
  crewSize: Type.Optional(Type.Integer({ minimum: 0 })),
  faoAreaCode: Type.Optional(Type.String({ maxLength: 20 })),
  dataClassification: Type.Optional(Type.String()),
});

export const EffortFilterSchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  sort: Type.Optional(Type.String()),
  order: Type.Optional(Type.Union([Type.Literal('asc'), Type.Literal('desc')])),
  effortType: Type.Optional(Type.String()),
  gearType: Type.Optional(Type.String()),
  vesselId: Type.Optional(Type.String({ format: 'uuid' })),
  captureId: Type.Optional(Type.String({ format: 'uuid' })),
  faoAreaCode: Type.Optional(Type.String()),
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

export type CreateEffortInput = Static<typeof CreateEffortSchema>;
export type UpdateEffortInput = Static<typeof UpdateEffortSchema>;
export type EffortFilterInput = Static<typeof EffortFilterSchema>;
export type PaginationQueryInput = Static<typeof PaginationQuerySchema>;
export type UuidParamInput = Static<typeof UuidParamSchema>;

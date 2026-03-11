import { Type, type Static } from '@sinclair/typebox';

const DataClassificationEnum = Type.Union([
  Type.Literal('PUBLIC'),
  Type.Literal('PARTNER'),
  Type.Literal('RESTRICTED'),
  Type.Literal('CONFIDENTIAL'),
]);

export const CreateCapacitySchema = Type.Object({
  year: Type.Integer({ minimum: 1900, maximum: 2100 }),
  organizationName: Type.String({ minLength: 1, maxLength: 255 }),
  staffCount: Type.Integer({ minimum: 0 }),
  budgetUsd: Type.Number({ minimum: 0 }),
  pvsSelfAssessmentScore: Type.Optional(Type.Number({ minimum: 0, maximum: 5 })),
  oieStatus: Type.Optional(Type.String({ maxLength: 100 })),
  dataClassification: Type.Optional(DataClassificationEnum),
});

export const UpdateCapacitySchema = Type.Object({
  year: Type.Optional(Type.Integer({ minimum: 1900, maximum: 2100 })),
  organizationName: Type.Optional(Type.String({ minLength: 1, maxLength: 255 })),
  staffCount: Type.Optional(Type.Integer({ minimum: 0 })),
  budgetUsd: Type.Optional(Type.Number({ minimum: 0 })),
  pvsSelfAssessmentScore: Type.Optional(Type.Number({ minimum: 0, maximum: 5 })),
  oieStatus: Type.Optional(Type.String({ maxLength: 100 })),
  dataClassification: Type.Optional(DataClassificationEnum),
});

export const CapacityFilterSchema = Type.Object({
  year: Type.Optional(Type.Integer({ minimum: 1900 })),
  organizationName: Type.Optional(Type.String()),
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

export type CreateCapacityInput = Static<typeof CreateCapacitySchema>;
export type UpdateCapacityInput = Static<typeof UpdateCapacitySchema>;
export type CapacityFilterInput = Static<typeof CapacityFilterSchema>;
export type PaginationQueryInput = Static<typeof PaginationQuerySchema>;
export type UuidParamInput = Static<typeof UuidParamSchema>;

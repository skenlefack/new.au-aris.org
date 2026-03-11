import { Type, type Static } from '@sinclair/typebox';

const StakeholderTypeEnum = Type.Union([
  Type.Literal('GOVERNMENT'),
  Type.Literal('NGO'),
  Type.Literal('PRIVATE'),
  Type.Literal('ACADEMIC'),
  Type.Literal('INTERNATIONAL'),
]);

const DataClassificationEnum = Type.Union([
  Type.Literal('PUBLIC'),
  Type.Literal('PARTNER'),
  Type.Literal('RESTRICTED'),
  Type.Literal('CONFIDENTIAL'),
]);

export const CreateStakeholderSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 255 }),
  type: StakeholderTypeEnum,
  contactPerson: Type.Optional(Type.String({ maxLength: 255 })),
  email: Type.Optional(Type.String({ format: 'email' })),
  domains: Type.Array(Type.String(), { minItems: 1 }),
  dataClassification: Type.Optional(DataClassificationEnum),
});

export const UpdateStakeholderSchema = Type.Object({
  name: Type.Optional(Type.String({ minLength: 1, maxLength: 255 })),
  type: Type.Optional(StakeholderTypeEnum),
  contactPerson: Type.Optional(Type.String({ maxLength: 255 })),
  email: Type.Optional(Type.String({ format: 'email' })),
  domains: Type.Optional(Type.Array(Type.String(), { minItems: 1 })),
  dataClassification: Type.Optional(DataClassificationEnum),
});

export const StakeholderFilterSchema = Type.Object({
  type: Type.Optional(Type.String()),
  domain: Type.Optional(Type.String()),
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

export type CreateStakeholderInput = Static<typeof CreateStakeholderSchema>;
export type UpdateStakeholderInput = Static<typeof UpdateStakeholderSchema>;
export type StakeholderFilterInput = Static<typeof StakeholderFilterSchema>;
export type PaginationQueryInput = Static<typeof PaginationQuerySchema>;
export type UuidParamInput = Static<typeof UuidParamSchema>;

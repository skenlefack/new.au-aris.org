import { Type, type Static } from '@sinclair/typebox';

const FrameworkTypeEnum = Type.Union([
  Type.Literal('LAW'),
  Type.Literal('REGULATION'),
  Type.Literal('POLICY'),
  Type.Literal('STANDARD'),
  Type.Literal('GUIDELINE'),
]);

const FrameworkStatusEnum = Type.Union([
  Type.Literal('DRAFT'),
  Type.Literal('ADOPTED'),
  Type.Literal('IN_FORCE'),
  Type.Literal('REPEALED'),
]);

const DataClassificationEnum = Type.Union([
  Type.Literal('PUBLIC'),
  Type.Literal('PARTNER'),
  Type.Literal('RESTRICTED'),
  Type.Literal('CONFIDENTIAL'),
]);

export const CreateLegalFrameworkSchema = Type.Object({
  title: Type.String({ minLength: 1, maxLength: 500 }),
  type: FrameworkTypeEnum,
  domain: Type.String({ minLength: 1, maxLength: 255 }),
  adoptionDate: Type.Optional(Type.String({ format: 'date-time' })),
  status: FrameworkStatusEnum,
  documentFileId: Type.Optional(Type.String({ format: 'uuid' })),
  dataClassification: Type.Optional(DataClassificationEnum),
});

export const UpdateLegalFrameworkSchema = Type.Object({
  title: Type.Optional(Type.String({ minLength: 1, maxLength: 500 })),
  type: Type.Optional(FrameworkTypeEnum),
  domain: Type.Optional(Type.String({ minLength: 1, maxLength: 255 })),
  adoptionDate: Type.Optional(Type.String({ format: 'date-time' })),
  status: Type.Optional(FrameworkStatusEnum),
  documentFileId: Type.Optional(Type.String({ format: 'uuid' })),
  dataClassification: Type.Optional(DataClassificationEnum),
});

export const LegalFrameworkFilterSchema = Type.Object({
  type: Type.Optional(Type.String()),
  domain: Type.Optional(Type.String()),
  status: Type.Optional(Type.String()),
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

export type CreateLegalFrameworkInput = Static<typeof CreateLegalFrameworkSchema>;
export type UpdateLegalFrameworkInput = Static<typeof UpdateLegalFrameworkSchema>;
export type LegalFrameworkFilterInput = Static<typeof LegalFrameworkFilterSchema>;
export type PaginationQueryInput = Static<typeof PaginationQuerySchema>;
export type UuidParamInput = Static<typeof UuidParamSchema>;

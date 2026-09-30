import { Type, type Static } from '@sinclair/typebox';

export const DataClassificationEnum = Type.Union([
  Type.Literal('PUBLIC'),
  Type.Literal('PARTNER'),
  Type.Literal('RESTRICTED'),
  Type.Literal('CONFIDENTIAL'),
]);

export const PaginationQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  sort: Type.Optional(Type.String()),
  order: Type.Optional(Type.Union([Type.Literal('asc'), Type.Literal('desc')])),
});

export const UuidParamSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
});

export const ParentUuidParamSchema = Type.Object({
  programmeId: Type.String({ format: 'uuid' }),
});

export const NestedUuidParamSchema = Type.Object({
  programmeId: Type.String({ format: 'uuid' }),
  id: Type.String({ format: 'uuid' }),
});

export type PaginationQueryInput = Static<typeof PaginationQuerySchema>;
export type UuidParamInput = Static<typeof UuidParamSchema>;
export type ParentUuidParamInput = Static<typeof ParentUuidParamSchema>;
export type NestedUuidParamInput = Static<typeof NestedUuidParamSchema>;

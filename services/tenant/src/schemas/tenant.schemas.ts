import { Type, type Static } from '@sinclair/typebox';

export const CreateTenantSchema = Type.Object({
  name: Type.String({ minLength: 2, maxLength: 255 }),
  code: Type.String({ minLength: 1, maxLength: 20 }),
  level: Type.String(),
  parentId: Type.Optional(Type.String({ format: 'uuid' })),
  countryCode: Type.Optional(Type.String({ minLength: 2, maxLength: 2 })),
  recCode: Type.Optional(Type.String({ maxLength: 20 })),
  domain: Type.String({ maxLength: 100 }),
  config: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  isActive: Type.Optional(Type.Boolean()),
});

export const UpdateTenantSchema = Type.Object({
  name: Type.Optional(Type.String({ minLength: 2, maxLength: 255 })),
  domain: Type.Optional(Type.String({ maxLength: 100 })),
  config: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  isActive: Type.Optional(Type.Boolean()),
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

export type CreateTenantInput = Static<typeof CreateTenantSchema>;
export type UpdateTenantInput = Static<typeof UpdateTenantSchema>;
export type PaginationQueryInput = Static<typeof PaginationQuerySchema>;
export type UuidParamInput = Static<typeof UuidParamSchema>;

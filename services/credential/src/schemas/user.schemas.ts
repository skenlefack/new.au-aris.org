import { Type, type Static } from '@sinclair/typebox';

export const UpdateUserSchema = Type.Object({
  email: Type.Optional(Type.String({ format: 'email' })),
  firstName: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
  lastName: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
  role: Type.Optional(Type.String()),
  isActive: Type.Optional(Type.Boolean()),
  locale: Type.Optional(Type.Union([
    Type.Literal('en'),
    Type.Literal('fr'),
    Type.Literal('pt'),
    Type.Literal('es'),
    Type.Literal('ar'),
  ])),
  avatarUrl: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  domainIds: Type.Optional(Type.Array(Type.String({ format: 'uuid' }))),
});

export const UpdateProfileSchema = Type.Object({
  firstName: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
  lastName: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
  email: Type.Optional(Type.String({ format: 'email' })),
  avatarUrl: Type.Optional(Type.Union([Type.String(), Type.Null()])),
});

export const UpdateLocaleSchema = Type.Object({
  locale: Type.Union([
    Type.Literal('en'),
    Type.Literal('fr'),
    Type.Literal('pt'),
    Type.Literal('es'),
    Type.Literal('ar'),
  ]),
});

export const PaginationQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  sort: Type.Optional(Type.String()),
  order: Type.Optional(Type.Union([Type.Literal('asc'), Type.Literal('desc')])),
  search: Type.Optional(Type.String()),
  role: Type.Optional(Type.String()),
  status: Type.Optional(Type.String()),
});

export const UuidParamSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
});

export type UpdateUserInput = Static<typeof UpdateUserSchema>;
export type UpdateProfileInput = Static<typeof UpdateProfileSchema>;
export type UpdateLocaleInput = Static<typeof UpdateLocaleSchema>;
export type PaginationQueryInput = Static<typeof PaginationQuerySchema>;
export type UuidParamInput = Static<typeof UuidParamSchema>;

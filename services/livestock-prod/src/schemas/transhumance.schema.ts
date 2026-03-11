import { Type, type Static } from '@sinclair/typebox';

export const CreateTranshumanceSchema = Type.Object({
  name: Type.String({ minLength: 2, maxLength: 255 }),
  route: Type.Unknown(),
  speciesId: Type.String({ format: 'uuid' }),
  seasonality: Type.String({ minLength: 1, maxLength: 100 }),
  crossBorder: Type.Optional(Type.Boolean()),
  dataClassification: Type.Optional(
    Type.Union([
      Type.Literal('PUBLIC'),
      Type.Literal('PARTNER'),
      Type.Literal('RESTRICTED'),
      Type.Literal('CONFIDENTIAL'),
    ]),
  ),
});
export type CreateTranshumanceInput = Static<typeof CreateTranshumanceSchema>;

export const UpdateTranshumanceSchema = Type.Object({
  name: Type.Optional(Type.String({ minLength: 2, maxLength: 255 })),
  route: Type.Optional(Type.Unknown()),
  speciesId: Type.Optional(Type.String({ format: 'uuid' })),
  seasonality: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
  crossBorder: Type.Optional(Type.Boolean()),
  dataClassification: Type.Optional(
    Type.Union([
      Type.Literal('PUBLIC'),
      Type.Literal('PARTNER'),
      Type.Literal('RESTRICTED'),
      Type.Literal('CONFIDENTIAL'),
    ]),
  ),
});
export type UpdateTranshumanceInput = Static<typeof UpdateTranshumanceSchema>;

export const TranshumanceFilterSchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  crossBorder: Type.Optional(Type.Boolean()),
  speciesId: Type.Optional(Type.String({ format: 'uuid' })),
});
export type TranshumanceFilterInput = Static<typeof TranshumanceFilterSchema>;

export const PaginationQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
});
export type PaginationQueryInput = Static<typeof PaginationQuerySchema>;

export const UuidParamSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
});
export type UuidParamInput = Static<typeof UuidParamSchema>;

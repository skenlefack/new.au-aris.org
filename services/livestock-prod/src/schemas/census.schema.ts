import { Type, type Static } from '@sinclair/typebox';

export const CreateCensusSchema = Type.Object({
  geoEntityId: Type.String({ format: 'uuid' }),
  speciesId: Type.String({ format: 'uuid' }),
  year: Type.Integer({ minimum: 1900, maximum: 2100 }),
  population: Type.Integer({ minimum: 0 }),
  methodology: Type.String({ minLength: 1, maxLength: 255 }),
  source: Type.String({ minLength: 1, maxLength: 255 }),
  dataClassification: Type.Optional(
    Type.Union([
      Type.Literal('PUBLIC'),
      Type.Literal('PARTNER'),
      Type.Literal('RESTRICTED'),
      Type.Literal('CONFIDENTIAL'),
    ]),
  ),
});
export type CreateCensusInput = Static<typeof CreateCensusSchema>;

export const UpdateCensusSchema = Type.Object({
  geoEntityId: Type.Optional(Type.String({ format: 'uuid' })),
  speciesId: Type.Optional(Type.String({ format: 'uuid' })),
  year: Type.Optional(Type.Integer({ minimum: 1900, maximum: 2100 })),
  population: Type.Optional(Type.Integer({ minimum: 0 })),
  methodology: Type.Optional(Type.String({ minLength: 1, maxLength: 255 })),
  source: Type.Optional(Type.String({ minLength: 1, maxLength: 255 })),
  dataClassification: Type.Optional(
    Type.Union([
      Type.Literal('PUBLIC'),
      Type.Literal('PARTNER'),
      Type.Literal('RESTRICTED'),
      Type.Literal('CONFIDENTIAL'),
    ]),
  ),
});
export type UpdateCensusInput = Static<typeof UpdateCensusSchema>;

export const CensusFilterSchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  speciesId: Type.Optional(Type.String({ format: 'uuid' })),
  geoEntityId: Type.Optional(Type.String({ format: 'uuid' })),
  year: Type.Optional(Type.Integer({ minimum: 1900, maximum: 2100 })),
});
export type CensusFilterInput = Static<typeof CensusFilterSchema>;

export const PaginationQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
});
export type PaginationQueryInput = Static<typeof PaginationQuerySchema>;

export const UuidParamSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
});
export type UuidParamInput = Static<typeof UuidParamSchema>;

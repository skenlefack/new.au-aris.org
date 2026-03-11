import { Type, type Static } from '@sinclair/typebox';

export const CreateSlaughterSchema = Type.Object({
  speciesId: Type.String({ format: 'uuid' }),
  facilityId: Type.String({ format: 'uuid' }),
  count: Type.Integer({ minimum: 0 }),
  condemnations: Type.Optional(Type.Integer({ minimum: 0 })),
  periodStart: Type.String({ format: 'date-time' }),
  periodEnd: Type.String({ format: 'date-time' }),
  geoEntityId: Type.String({ format: 'uuid' }),
  dataClassification: Type.Optional(
    Type.Union([
      Type.Literal('PUBLIC'),
      Type.Literal('PARTNER'),
      Type.Literal('RESTRICTED'),
      Type.Literal('CONFIDENTIAL'),
    ]),
  ),
});
export type CreateSlaughterInput = Static<typeof CreateSlaughterSchema>;

export const UpdateSlaughterSchema = Type.Object({
  speciesId: Type.Optional(Type.String({ format: 'uuid' })),
  facilityId: Type.Optional(Type.String({ format: 'uuid' })),
  count: Type.Optional(Type.Integer({ minimum: 0 })),
  condemnations: Type.Optional(Type.Integer({ minimum: 0 })),
  periodStart: Type.Optional(Type.String({ format: 'date-time' })),
  periodEnd: Type.Optional(Type.String({ format: 'date-time' })),
  geoEntityId: Type.Optional(Type.String({ format: 'uuid' })),
  dataClassification: Type.Optional(
    Type.Union([
      Type.Literal('PUBLIC'),
      Type.Literal('PARTNER'),
      Type.Literal('RESTRICTED'),
      Type.Literal('CONFIDENTIAL'),
    ]),
  ),
});
export type UpdateSlaughterInput = Static<typeof UpdateSlaughterSchema>;

export const SlaughterFilterSchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  speciesId: Type.Optional(Type.String({ format: 'uuid' })),
  facilityId: Type.Optional(Type.String({ format: 'uuid' })),
  geoEntityId: Type.Optional(Type.String({ format: 'uuid' })),
});
export type SlaughterFilterInput = Static<typeof SlaughterFilterSchema>;

export const PaginationQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
});
export type PaginationQueryInput = Static<typeof PaginationQuerySchema>;

export const UuidParamSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
});
export type UuidParamInput = Static<typeof UuidParamSchema>;

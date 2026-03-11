import { Type, type Static } from '@sinclair/typebox';

export const CreateProductionSchema = Type.Object({
  speciesId: Type.String({ format: 'uuid' }),
  productType: Type.String({ minLength: 1, maxLength: 100 }),
  quantity: Type.Number({ minimum: 0 }),
  unit: Type.String({ minLength: 1, maxLength: 50 }),
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
export type CreateProductionInput = Static<typeof CreateProductionSchema>;

export const UpdateProductionSchema = Type.Object({
  speciesId: Type.Optional(Type.String({ format: 'uuid' })),
  productType: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
  quantity: Type.Optional(Type.Number({ minimum: 0 })),
  unit: Type.Optional(Type.String({ minLength: 1, maxLength: 50 })),
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
export type UpdateProductionInput = Static<typeof UpdateProductionSchema>;

export const ProductionFilterSchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  speciesId: Type.Optional(Type.String({ format: 'uuid' })),
  productType: Type.Optional(Type.String()),
  year: Type.Optional(Type.Integer({ minimum: 1900, maximum: 2100 })),
  geoEntityId: Type.Optional(Type.String({ format: 'uuid' })),
});
export type ProductionFilterInput = Static<typeof ProductionFilterSchema>;

export const PaginationQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
});
export type PaginationQueryInput = Static<typeof PaginationQuerySchema>;

export const UuidParamSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
});
export type UuidParamInput = Static<typeof UuidParamSchema>;

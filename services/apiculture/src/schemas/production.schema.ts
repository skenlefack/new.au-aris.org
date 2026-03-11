import { Type, type Static } from '@sinclair/typebox';

export const CreateProductionSchema = Type.Object({
  apiaryId: Type.String({ format: 'uuid' }),
  harvestDate: Type.String({ format: 'date-time' }),
  quantity: Type.Number({ minimum: 0 }),
  unit: Type.String({ minLength: 1, maxLength: 50 }),
  quality: Type.Union([
    Type.Literal('GRADE_A'),
    Type.Literal('GRADE_B'),
    Type.Literal('GRADE_C'),
  ]),
  floralSource: Type.String({ minLength: 1, maxLength: 255 }),
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
  apiaryId: Type.Optional(Type.String({ format: 'uuid' })),
  harvestDate: Type.Optional(Type.String({ format: 'date-time' })),
  quantity: Type.Optional(Type.Number({ minimum: 0 })),
  unit: Type.Optional(Type.String({ minLength: 1, maxLength: 50 })),
  quality: Type.Optional(
    Type.Union([
      Type.Literal('GRADE_A'),
      Type.Literal('GRADE_B'),
      Type.Literal('GRADE_C'),
    ]),
  ),
  floralSource: Type.Optional(Type.String({ minLength: 1, maxLength: 255 })),
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
  apiaryId: Type.Optional(Type.String({ format: 'uuid' })),
  quality: Type.Optional(
    Type.Union([
      Type.Literal('GRADE_A'),
      Type.Literal('GRADE_B'),
      Type.Literal('GRADE_C'),
    ]),
  ),
  periodStart: Type.Optional(Type.String({ format: 'date-time' })),
  periodEnd: Type.Optional(Type.String({ format: 'date-time' })),
});
export type ProductionFilterInput = Static<typeof ProductionFilterSchema>;

export const UuidParamSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
});
export type UuidParamInput = Static<typeof UuidParamSchema>;

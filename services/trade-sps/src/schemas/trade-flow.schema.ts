import { Type, type Static } from '@sinclair/typebox';

export const CreateTradeFlowSchema = Type.Object({
  exportCountryId: Type.String({ format: 'uuid' }),
  importCountryId: Type.String({ format: 'uuid' }),
  speciesId: Type.String({ format: 'uuid' }),
  commodity: Type.String({ minLength: 1, maxLength: 255 }),
  flowDirection: Type.Union([
    Type.Literal('IMPORT'),
    Type.Literal('EXPORT'),
    Type.Literal('TRANSIT'),
  ]),
  quantity: Type.Number({ minimum: 0 }),
  unit: Type.String({ minLength: 1, maxLength: 50 }),
  valueFob: Type.Optional(Type.Number({ minimum: 0 })),
  currency: Type.Optional(Type.String({ minLength: 1, maxLength: 10 })),
  periodStart: Type.Optional(Type.String({ format: 'date-time' })),
  periodEnd: Type.Optional(Type.String({ format: 'date-time' })),
  hsCode: Type.Optional(Type.String({ minLength: 1, maxLength: 20 })),
  spsStatus: Type.Optional(Type.String({ minLength: 1, maxLength: 50 })),
  dataClassification: Type.Optional(
    Type.Union([
      Type.Literal('PUBLIC'),
      Type.Literal('PARTNER'),
      Type.Literal('RESTRICTED'),
      Type.Literal('CONFIDENTIAL'),
    ]),
  ),
});
export type CreateTradeFlowInput = Static<typeof CreateTradeFlowSchema>;

export const UpdateTradeFlowSchema = Type.Object({
  exportCountryId: Type.Optional(Type.String({ format: 'uuid' })),
  importCountryId: Type.Optional(Type.String({ format: 'uuid' })),
  speciesId: Type.Optional(Type.String({ format: 'uuid' })),
  commodity: Type.Optional(Type.String({ minLength: 1, maxLength: 255 })),
  flowDirection: Type.Optional(
    Type.Union([
      Type.Literal('IMPORT'),
      Type.Literal('EXPORT'),
      Type.Literal('TRANSIT'),
    ]),
  ),
  quantity: Type.Optional(Type.Number({ minimum: 0 })),
  unit: Type.Optional(Type.String({ minLength: 1, maxLength: 50 })),
  valueFob: Type.Optional(Type.Number({ minimum: 0 })),
  currency: Type.Optional(Type.String({ minLength: 1, maxLength: 10 })),
  periodStart: Type.Optional(Type.String({ format: 'date-time' })),
  periodEnd: Type.Optional(Type.String({ format: 'date-time' })),
  hsCode: Type.Optional(Type.String({ minLength: 1, maxLength: 20 })),
  spsStatus: Type.Optional(Type.String({ minLength: 1, maxLength: 50 })),
  dataClassification: Type.Optional(
    Type.Union([
      Type.Literal('PUBLIC'),
      Type.Literal('PARTNER'),
      Type.Literal('RESTRICTED'),
      Type.Literal('CONFIDENTIAL'),
    ]),
  ),
});
export type UpdateTradeFlowInput = Static<typeof UpdateTradeFlowSchema>;

export const TradeFlowFilterSchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  exportCountryId: Type.Optional(Type.String({ format: 'uuid' })),
  importCountryId: Type.Optional(Type.String({ format: 'uuid' })),
  speciesId: Type.Optional(Type.String({ format: 'uuid' })),
  commodity: Type.Optional(Type.String()),
  flowDirection: Type.Optional(
    Type.Union([
      Type.Literal('IMPORT'),
      Type.Literal('EXPORT'),
      Type.Literal('TRANSIT'),
    ]),
  ),
  periodStart: Type.Optional(Type.String({ format: 'date-time' })),
  periodEnd: Type.Optional(Type.String({ format: 'date-time' })),
});
export type TradeFlowFilterInput = Static<typeof TradeFlowFilterSchema>;

export const UuidParamSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
});
export type UuidParamInput = Static<typeof UuidParamSchema>;

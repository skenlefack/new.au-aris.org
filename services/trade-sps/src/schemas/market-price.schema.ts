import { Type, type Static } from '@sinclair/typebox';

export const CreateMarketPriceSchema = Type.Object({
  marketId: Type.String({ format: 'uuid' }),
  speciesId: Type.String({ format: 'uuid' }),
  commodity: Type.String({ minLength: 1, maxLength: 255 }),
  priceType: Type.String({ minLength: 1, maxLength: 100 }),
  price: Type.Number({ minimum: 0 }),
  currency: Type.String({ minLength: 1, maxLength: 10 }),
  unit: Type.String({ minLength: 1, maxLength: 50 }),
  date: Type.Optional(Type.String({ format: 'date-time' })),
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
export type CreateMarketPriceInput = Static<typeof CreateMarketPriceSchema>;

export const UpdateMarketPriceSchema = Type.Object({
  marketId: Type.Optional(Type.String({ format: 'uuid' })),
  speciesId: Type.Optional(Type.String({ format: 'uuid' })),
  commodity: Type.Optional(Type.String({ minLength: 1, maxLength: 255 })),
  priceType: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
  price: Type.Optional(Type.Number({ minimum: 0 })),
  currency: Type.Optional(Type.String({ minLength: 1, maxLength: 10 })),
  unit: Type.Optional(Type.String({ minLength: 1, maxLength: 50 })),
  date: Type.Optional(Type.String({ format: 'date-time' })),
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
export type UpdateMarketPriceInput = Static<typeof UpdateMarketPriceSchema>;

export const MarketPriceFilterSchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  marketId: Type.Optional(Type.String({ format: 'uuid' })),
  speciesId: Type.Optional(Type.String({ format: 'uuid' })),
  commodity: Type.Optional(Type.String()),
  priceType: Type.Optional(Type.String()),
  periodStart: Type.Optional(Type.String({ format: 'date-time' })),
  periodEnd: Type.Optional(Type.String({ format: 'date-time' })),
});
export type MarketPriceFilterInput = Static<typeof MarketPriceFilterSchema>;

export const UuidParamSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
});
export type UuidParamInput = Static<typeof UuidParamSchema>;

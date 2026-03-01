import { Type, type Static } from '@sinclair/typebox';

export const TransactionQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  connectionId: Type.Optional(Type.String({ format: 'uuid' })),
  status: Type.Optional(Type.Union([
    Type.Literal('PENDING'),
    Type.Literal('PROCESSING'),
    Type.Literal('COMPLETED'),
    Type.Literal('FAILED'),
    Type.Literal('RETRY'),
  ])),
  sort: Type.Optional(Type.String()),
  order: Type.Optional(Type.Union([Type.Literal('asc'), Type.Literal('desc')])),
});
export type TransactionQueryInput = Static<typeof TransactionQuerySchema>;

export const TransactionIdParamSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
});
export type TransactionIdParam = Static<typeof TransactionIdParamSchema>;

export const TransformTestSchema = Type.Object({
  data: Type.Unknown(),
  expression: Type.String({ minLength: 1 }),
});
export type TransformTestBody = Static<typeof TransformTestSchema>;

import { Type, type Static } from '@sinclair/typebox';

const MultilingualName = Type.Object({
  en: Type.String({ minLength: 1 }),
  fr: Type.Optional(Type.String()),
  pt: Type.Optional(Type.String()),
  ar: Type.Optional(Type.String()),
});

export const CreateIndicatorSchema = Type.Object({
  outputId: Type.String({ format: 'uuid' }),
  code: Type.String({ minLength: 1, maxLength: 30 }),
  name: MultilingualName,
  unit: Type.String({ minLength: 1, maxLength: 50 }),
  direction: Type.Optional(Type.Union([
    Type.Literal('INCREASE'),
    Type.Literal('DECREASE'),
    Type.Literal('MAINTAIN'),
  ])),
  baselineValue: Type.Optional(Type.Number()),
  baselineDate: Type.Optional(Type.String({ format: 'date' })),
  targetValue: Type.Number(),
  dataSource: Type.Optional(Type.String({ maxLength: 200 })),
  collectionMethod: Type.Optional(Type.Union([
    Type.Literal('AUTOMATIC'),
    Type.Literal('MANUAL'),
    Type.Literal('SURVEY'),
  ])),
  disaggregationBy: Type.Optional(Type.Array(Type.String())),
});

export const UpdateIndicatorSchema = Type.Object({
  code: Type.Optional(Type.String({ maxLength: 30 })),
  name: Type.Optional(MultilingualName),
  unit: Type.Optional(Type.String({ maxLength: 50 })),
  direction: Type.Optional(Type.String()),
  baselineValue: Type.Optional(Type.Number()),
  baselineDate: Type.Optional(Type.String({ format: 'date' })),
  targetValue: Type.Optional(Type.Number()),
  dataSource: Type.Optional(Type.String({ maxLength: 200 })),
  collectionMethod: Type.Optional(Type.String()),
  disaggregationBy: Type.Optional(Type.Array(Type.String())),
});

export const CreateIndicatorValueSchema = Type.Object({
  period: Type.String({ minLength: 1, maxLength: 20 }),
  actualValue: Type.Number(),
  evidenceUrl: Type.Optional(Type.String()),
  disaggregation: Type.Optional(Type.Record(Type.String(), Type.Number())),
  comment: Type.Optional(Type.String()),
});

export const ValidateIndicatorValueSchema = Type.Object({
  verifiedValue: Type.Number(),
  comment: Type.Optional(Type.String()),
});

export type CreateIndicatorInput = Static<typeof CreateIndicatorSchema>;
export type UpdateIndicatorInput = Static<typeof UpdateIndicatorSchema>;
export type CreateIndicatorValueInput = Static<typeof CreateIndicatorValueSchema>;
export type ValidateIndicatorValueInput = Static<typeof ValidateIndicatorValueSchema>;

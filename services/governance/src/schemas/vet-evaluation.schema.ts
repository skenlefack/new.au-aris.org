import { Type, type Static } from '@sinclair/typebox';

const VetEvaluationTypeEnum = Type.Union([
  Type.Literal('INITIAL'),
  Type.Literal('GAP_ANALYSIS'),
  Type.Literal('FOLLOW_UP'),
]);

const DataClassificationEnum = Type.Union([
  Type.Literal('PUBLIC'),
  Type.Literal('PARTNER'),
  Type.Literal('RESTRICTED'),
  Type.Literal('CONFIDENTIAL'),
]);

export const CreateVetEvaluationSchema = Type.Object({
  evaluationType: VetEvaluationTypeEnum,
  evaluationDate: Type.String({ format: 'date-time' }),
  overallScore: Type.Number({ minimum: 0, maximum: 5 }),
  criticalCompetencies: Type.Record(Type.String(), Type.Unknown()),
  recommendations: Type.Array(Type.String()),
  dataClassification: Type.Optional(DataClassificationEnum),
});

export const UpdateVetEvaluationSchema = Type.Object({
  evaluationType: Type.Optional(VetEvaluationTypeEnum),
  evaluationDate: Type.Optional(Type.String({ format: 'date-time' })),
  overallScore: Type.Optional(Type.Number({ minimum: 0, maximum: 5 })),
  criticalCompetencies: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  recommendations: Type.Optional(Type.Array(Type.String())),
  dataClassification: Type.Optional(DataClassificationEnum),
});

export const VetEvaluationFilterSchema = Type.Object({
  evaluationType: Type.Optional(Type.String()),
  periodStart: Type.Optional(Type.String({ format: 'date-time' })),
  periodEnd: Type.Optional(Type.String({ format: 'date-time' })),
});

export const PaginationQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  sort: Type.Optional(Type.String()),
  order: Type.Optional(Type.Union([Type.Literal('asc'), Type.Literal('desc')])),
});

export const UuidParamSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
});

export type CreateVetEvaluationInput = Static<typeof CreateVetEvaluationSchema>;
export type UpdateVetEvaluationInput = Static<typeof UpdateVetEvaluationSchema>;
export type VetEvaluationFilterInput = Static<typeof VetEvaluationFilterSchema>;
export type PaginationQueryInput = Static<typeof PaginationQuerySchema>;
export type UuidParamInput = Static<typeof UuidParamSchema>;

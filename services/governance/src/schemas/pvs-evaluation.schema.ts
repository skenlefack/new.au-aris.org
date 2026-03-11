import { Type, type Static } from '@sinclair/typebox';

const PVSEvaluationTypeEnum = Type.Union([
  Type.Literal('PVS'),
  Type.Literal('PVS_GAP'),
  Type.Literal('PVS_FOLLOW_UP'),
]);

const DataClassificationEnum = Type.Union([
  Type.Literal('PUBLIC'),
  Type.Literal('PARTNER'),
  Type.Literal('RESTRICTED'),
  Type.Literal('CONFIDENTIAL'),
]);

export const CreatePvsEvaluationSchema = Type.Object({
  evaluationType: PVSEvaluationTypeEnum,
  evaluationDate: Type.String({ format: 'date-time' }),
  overallScore: Type.Number({ minimum: 0, maximum: 5 }),
  criticalCompetencies: Type.Record(Type.String(), Type.Unknown()),
  recommendations: Type.Array(Type.String()),
  dataClassification: Type.Optional(DataClassificationEnum),
});

export const UpdatePvsEvaluationSchema = Type.Object({
  evaluationType: Type.Optional(PVSEvaluationTypeEnum),
  evaluationDate: Type.Optional(Type.String({ format: 'date-time' })),
  overallScore: Type.Optional(Type.Number({ minimum: 0, maximum: 5 })),
  criticalCompetencies: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  recommendations: Type.Optional(Type.Array(Type.String())),
  dataClassification: Type.Optional(DataClassificationEnum),
});

export const PvsEvaluationFilterSchema = Type.Object({
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

export type CreatePvsEvaluationInput = Static<typeof CreatePvsEvaluationSchema>;
export type UpdatePvsEvaluationInput = Static<typeof UpdatePvsEvaluationSchema>;
export type PvsEvaluationFilterInput = Static<typeof PvsEvaluationFilterSchema>;
export type PaginationQueryInput = Static<typeof PaginationQuerySchema>;
export type UuidParamInput = Static<typeof UuidParamSchema>;

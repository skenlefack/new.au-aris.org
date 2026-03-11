import { Type, Static } from '@sinclair/typebox';

// ── Shared enums ──

const PublicationTypeEnum = Type.Union([
  Type.Literal('BRIEF'),
  Type.Literal('REPORT'),
  Type.Literal('GUIDELINE'),
  Type.Literal('BULLETIN'),
]);

const LanguageCodeEnum = Type.Union([
  Type.Literal('EN'),
  Type.Literal('FR'),
]);

const DataClassificationEnum = Type.Union([
  Type.Literal('PUBLIC'),
  Type.Literal('PARTNER'),
  Type.Literal('RESTRICTED'),
  Type.Literal('CONFIDENTIAL'),
]);

const OrderEnum = Type.Union([
  Type.Literal('asc'),
  Type.Literal('desc'),
]);

// ── Pagination ──

export const PaginationQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
  sort: Type.Optional(Type.String()),
  order: Type.Optional(OrderEnum),
});
export type PaginationQueryInput = Static<typeof PaginationQuerySchema>;

// ── UUID param ──

export const UuidParamSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
});
export type UuidParamInput = Static<typeof UuidParamSchema>;

// ── Publication ──

export const CreatePublicationSchema = Type.Object({
  title: Type.String({ minLength: 2, maxLength: 500 }),
  abstract: Type.Optional(Type.String()),
  authors: Type.Array(Type.String()),
  domain: Type.String({ maxLength: 100 }),
  type: PublicationTypeEnum,
  fileId: Type.Optional(Type.String({ format: 'uuid' })),
  publishedAt: Type.Optional(Type.String()),
  tags: Type.Optional(Type.Array(Type.String())),
  language: Type.Optional(LanguageCodeEnum),
  dataClassification: Type.Optional(DataClassificationEnum),
});
export type CreatePublicationInput = Static<typeof CreatePublicationSchema>;

export const UpdatePublicationSchema = Type.Object({
  title: Type.Optional(Type.String({ minLength: 2, maxLength: 500 })),
  abstract: Type.Optional(Type.String()),
  authors: Type.Optional(Type.Array(Type.String())),
  domain: Type.Optional(Type.String({ maxLength: 100 })),
  type: Type.Optional(PublicationTypeEnum),
  fileId: Type.Optional(Type.String({ format: 'uuid' })),
  publishedAt: Type.Optional(Type.String()),
  tags: Type.Optional(Type.Array(Type.String())),
  language: Type.Optional(LanguageCodeEnum),
  dataClassification: Type.Optional(DataClassificationEnum),
});
export type UpdatePublicationInput = Static<typeof UpdatePublicationSchema>;

export const PublicationFilterSchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
  sort: Type.Optional(Type.String()),
  order: Type.Optional(OrderEnum),
  domain: Type.Optional(Type.String()),
  type: Type.Optional(Type.String()),
  language: Type.Optional(Type.String()),
  tag: Type.Optional(Type.String()),
});
export type PublicationFilterInput = Static<typeof PublicationFilterSchema>;

// ── FAQ ──

export const CreateFaqSchema = Type.Object({
  question: Type.String({ minLength: 5 }),
  answer: Type.String({ minLength: 1 }),
  domain: Type.String({ maxLength: 100 }),
  language: Type.Optional(LanguageCodeEnum),
  sortOrder: Type.Optional(Type.Integer({ minimum: 0 })),
  dataClassification: Type.Optional(DataClassificationEnum),
});
export type CreateFaqInput = Static<typeof CreateFaqSchema>;

export const UpdateFaqSchema = Type.Object({
  question: Type.Optional(Type.String({ minLength: 5 })),
  answer: Type.Optional(Type.String({ minLength: 1 })),
  domain: Type.Optional(Type.String({ maxLength: 100 })),
  language: Type.Optional(LanguageCodeEnum),
  sortOrder: Type.Optional(Type.Integer({ minimum: 0 })),
  dataClassification: Type.Optional(DataClassificationEnum),
});
export type UpdateFaqInput = Static<typeof UpdateFaqSchema>;

export const FaqFilterSchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
  sort: Type.Optional(Type.String()),
  order: Type.Optional(OrderEnum),
  domain: Type.Optional(Type.String()),
  language: Type.Optional(Type.String()),
});
export type FaqFilterInput = Static<typeof FaqFilterSchema>;

// ── E-Learning ──

export const CreateELearningSchema = Type.Object({
  title: Type.String({ minLength: 2, maxLength: 500 }),
  description: Type.Optional(Type.String()),
  domain: Type.String({ maxLength: 100 }),
  lessons: Type.Array(Type.Object({}, { additionalProperties: true })),
  estimatedDuration: Type.Number({ minimum: 0 }),
  prerequisiteIds: Type.Optional(Type.Array(Type.String({ format: 'uuid' }))),
  publishedAt: Type.Optional(Type.String()),
  dataClassification: Type.Optional(DataClassificationEnum),
});
export type CreateELearningInput = Static<typeof CreateELearningSchema>;

export const UpdateELearningSchema = Type.Object({
  title: Type.Optional(Type.String({ minLength: 2, maxLength: 500 })),
  description: Type.Optional(Type.String()),
  domain: Type.Optional(Type.String({ maxLength: 100 })),
  lessons: Type.Optional(Type.Array(Type.Object({}, { additionalProperties: true }))),
  estimatedDuration: Type.Optional(Type.Number({ minimum: 0 })),
  prerequisiteIds: Type.Optional(Type.Array(Type.String({ format: 'uuid' }))),
  publishedAt: Type.Optional(Type.String()),
  dataClassification: Type.Optional(DataClassificationEnum),
});
export type UpdateELearningInput = Static<typeof UpdateELearningSchema>;

export const ELearningFilterSchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
  sort: Type.Optional(Type.String()),
  order: Type.Optional(OrderEnum),
  domain: Type.Optional(Type.String()),
});
export type ELearningFilterInput = Static<typeof ELearningFilterSchema>;

export const UpdateProgressSchema = Type.Object({
  completedLessons: Type.Array(Type.String()),
  score: Type.Optional(Type.Number({ minimum: 0, maximum: 100 })),
});
export type UpdateProgressInput = Static<typeof UpdateProgressSchema>;

import { Type, Static } from '@sinclair/typebox';

// ── Shared enums ──

const PublicationTypeEnum = Type.Union([
  Type.Literal('ARTICLE'),
  Type.Literal('REPORT'),
  Type.Literal('BRIEF'),
  Type.Literal('GUIDELINE'),
  Type.Literal('NEWS'),
  Type.Literal('EVENT'),
  Type.Literal('FAQ'),
  Type.Literal('DATASET'),
  Type.Literal('INFOGRAPHIC'),
  Type.Literal('VIDEO'),
  Type.Literal('ANNOUNCEMENT'),
]);

const PublicationStatusEnum = Type.Union([
  Type.Literal('DRAFT'),
  Type.Literal('SUBMITTED'),
  Type.Literal('UNDER_REVIEW'),
  Type.Literal('APPROVED'),
  Type.Literal('REJECTED'),
  Type.Literal('PUBLISHED'),
  Type.Literal('ARCHIVED'),
]);

const VisibilityEnum = Type.Union([
  Type.Literal('PUBLIC'),
  Type.Literal('PRIVATE'),
]);

const DataClassificationEnum = Type.Union([
  Type.Literal('PUBLIC'),
  Type.Literal('PARTNER'),
  Type.Literal('RESTRICTED'),
  Type.Literal('CONFIDENTIAL'),
]);

const CategoryScopeEnum = Type.Union([
  Type.Literal('CONTINENTAL'),
  Type.Literal('REC'),
  Type.Literal('COUNTRY'),
]);

const AttachmentKindEnum = Type.Union([
  Type.Literal('DOCUMENT'),
  Type.Literal('IMAGE'),
  Type.Literal('VIDEO'),
  Type.Literal('AUDIO'),
  Type.Literal('ARCHIVE'),
  Type.Literal('OTHER'),
]);

const ReviewDecisionEnum = Type.Union([
  Type.Literal('APPROVED'),
  Type.Literal('REJECTED'),
  Type.Literal('REQUEST_CHANGES'),
  Type.Literal('COMMENT'),
]);

const OrderEnum = Type.Union([
  Type.Literal('asc'),
  Type.Literal('desc'),
]);

// Multilingual JSON value: at least one of en/fr/pt/ar
const MultilingualText = Type.Object({
  en: Type.Optional(Type.String()),
  fr: Type.Optional(Type.String()),
  pt: Type.Optional(Type.String()),
  ar: Type.Optional(Type.String()),
});

// ── Common ──

export const UuidParamSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
});
export type UuidParamInput = Static<typeof UuidParamSchema>;

// ── Categories ──

export const CreateCategorySchema = Type.Object({
  parentId: Type.Optional(Type.String({ format: 'uuid' })),
  slug: Type.String({ minLength: 2, maxLength: 200, pattern: '^[a-z0-9-]+$' }),
  nameEn: Type.String({ minLength: 1, maxLength: 200 }),
  nameFr: Type.Optional(Type.String({ maxLength: 200 })),
  namePt: Type.Optional(Type.String({ maxLength: 200 })),
  nameAr: Type.Optional(Type.String({ maxLength: 200 })),
  descriptionEn: Type.Optional(Type.String()),
  descriptionFr: Type.Optional(Type.String()),
  descriptionPt: Type.Optional(Type.String()),
  descriptionAr: Type.Optional(Type.String()),
  scope: CategoryScopeEnum,
  scopeTenantId: Type.Optional(Type.String({ format: 'uuid' })),
  recParentTenantId: Type.Optional(Type.String({ format: 'uuid' })),
  icon: Type.Optional(Type.String({ maxLength: 50 })),
  color: Type.Optional(Type.String({ maxLength: 20 })),
  sortOrder: Type.Optional(Type.Integer({ minimum: 0 })),
});
export type CreateCategoryInput = Static<typeof CreateCategorySchema>;

export const UpdateCategorySchema = Type.Object({
  parentId: Type.Optional(Type.Union([Type.String({ format: 'uuid' }), Type.Null()])),
  nameEn: Type.Optional(Type.String({ minLength: 1, maxLength: 200 })),
  nameFr: Type.Optional(Type.String({ maxLength: 200 })),
  namePt: Type.Optional(Type.String({ maxLength: 200 })),
  nameAr: Type.Optional(Type.String({ maxLength: 200 })),
  descriptionEn: Type.Optional(Type.String()),
  descriptionFr: Type.Optional(Type.String()),
  descriptionPt: Type.Optional(Type.String()),
  descriptionAr: Type.Optional(Type.String()),
  icon: Type.Optional(Type.String({ maxLength: 50 })),
  color: Type.Optional(Type.String({ maxLength: 20 })),
  sortOrder: Type.Optional(Type.Integer({ minimum: 0 })),
  isActive: Type.Optional(Type.Boolean()),
});
export type UpdateCategoryInput = Static<typeof UpdateCategorySchema>;

export const CategoryFilterSchema = Type.Object({
  scope: Type.Optional(CategoryScopeEnum),
  scopeTenantId: Type.Optional(Type.String({ format: 'uuid' })),
  parentId: Type.Optional(Type.String({ format: 'uuid' })),
  search: Type.Optional(Type.String()),
  includePending: Type.Optional(Type.Boolean()),
});
export type CategoryFilterInput = Static<typeof CategoryFilterSchema>;

export const ReviewCategorySchema = Type.Object({
  decision: Type.Union([Type.Literal('APPROVED'), Type.Literal('REJECTED')]),
  comment: Type.Optional(Type.String({ maxLength: 2000 })),
});
export type ReviewCategoryInput = Static<typeof ReviewCategorySchema>;

// ── Publications ──

export const PublicationAttachmentInput = Type.Object({
  fileId: Type.String({ format: 'uuid' }),
  caption: Type.Optional(Type.String({ maxLength: 500 })),
  kind: AttachmentKindEnum,
  sortOrder: Type.Optional(Type.Integer({ minimum: 0 })),
});

export const CreatePublicationSchema = Type.Object({
  categoryId: Type.String({ format: 'uuid' }),
  title: MultilingualText,
  summary: Type.Optional(MultilingualText),
  contentHtml: MultilingualText,
  contentText: Type.Optional(MultilingualText),
  slug: Type.Optional(Type.String({ minLength: 2, maxLength: 250, pattern: '^[a-z0-9-]+$' })),
  type: PublicationTypeEnum,
  visibility: Type.Optional(VisibilityEnum),
  dataClassification: Type.Optional(DataClassificationEnum),
  authors: Type.Optional(Type.Array(Type.String())),
  tags: Type.Optional(Type.Array(Type.String())),
  coverImageId: Type.Optional(Type.String({ format: 'uuid' })),
  attachments: Type.Optional(Type.Array(PublicationAttachmentInput)),
  metaTitle: Type.Optional(MultilingualText),
  metaDescription: Type.Optional(MultilingualText),
});
export type CreatePublicationInput = Static<typeof CreatePublicationSchema>;

export const UpdatePublicationSchema = Type.Object({
  categoryId: Type.Optional(Type.String({ format: 'uuid' })),
  title: Type.Optional(MultilingualText),
  summary: Type.Optional(MultilingualText),
  contentHtml: Type.Optional(MultilingualText),
  contentText: Type.Optional(MultilingualText),
  type: Type.Optional(PublicationTypeEnum),
  visibility: Type.Optional(VisibilityEnum),
  dataClassification: Type.Optional(DataClassificationEnum),
  authors: Type.Optional(Type.Array(Type.String())),
  tags: Type.Optional(Type.Array(Type.String())),
  coverImageId: Type.Optional(Type.String({ format: 'uuid' })),
  attachments: Type.Optional(Type.Array(PublicationAttachmentInput)),
  metaTitle: Type.Optional(MultilingualText),
  metaDescription: Type.Optional(MultilingualText),
});
export type UpdatePublicationInput = Static<typeof UpdatePublicationSchema>;

export const PublicationFilterSchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
  sort: Type.Optional(Type.String()),
  order: Type.Optional(OrderEnum),
  categoryId: Type.Optional(Type.String({ format: 'uuid' })),
  type: Type.Optional(PublicationTypeEnum),
  status: Type.Optional(PublicationStatusEnum),
  visibility: Type.Optional(VisibilityEnum),
  scope: Type.Optional(CategoryScopeEnum),
  tag: Type.Optional(Type.String()),
  search: Type.Optional(Type.String()),
  mine: Type.Optional(Type.Boolean()),
});
export type PublicationFilterInput = Static<typeof PublicationFilterSchema>;

// ── Workflow actions ──

export const SubmitPublicationSchema = Type.Object({
  comment: Type.Optional(Type.String({ maxLength: 2000 })),
});
export type SubmitPublicationInput = Static<typeof SubmitPublicationSchema>;

export const ReviewPublicationSchema = Type.Object({
  decision: ReviewDecisionEnum,
  comment: Type.Optional(Type.String({ maxLength: 2000 })),
});
export type ReviewPublicationInput = Static<typeof ReviewPublicationSchema>;

// ── E-Learning ──

const CourseStatusEnum = Type.Union([
  Type.Literal('DRAFT'),
  Type.Literal('PUBLISHED'),
  Type.Literal('ARCHIVED'),
]);

export const CreateCourseSchema = Type.Object({
  title: MultilingualText,
  description: Type.Optional(MultilingualText),
  coverImageId: Type.Optional(Type.String({ format: 'uuid' })),
  domain: Type.Optional(Type.String({ maxLength: 50 })),
  tags: Type.Optional(Type.Array(Type.String())),
  estimatedHours: Type.Optional(Type.Number({ minimum: 0 })),
  modules: Type.Optional(Type.Array(Type.Object({
    title: MultilingualText,
    content: MultilingualText,
    sortOrder: Type.Optional(Type.Integer({ minimum: 0 })),
    durationMinutes: Type.Optional(Type.Integer({ minimum: 0 })),
  }))),
});
export type CreateCourseInput = Static<typeof CreateCourseSchema>;

export const UpdateCourseSchema = Type.Object({
  title: Type.Optional(MultilingualText),
  description: Type.Optional(MultilingualText),
  coverImageId: Type.Optional(Type.Union([Type.String({ format: 'uuid' }), Type.Null()])),
  domain: Type.Optional(Type.String({ maxLength: 50 })),
  tags: Type.Optional(Type.Array(Type.String())),
  estimatedHours: Type.Optional(Type.Number({ minimum: 0 })),
});
export type UpdateCourseInput = Static<typeof UpdateCourseSchema>;

export const CourseFilterSchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
  status: Type.Optional(CourseStatusEnum),
  domain: Type.Optional(Type.String()),
  search: Type.Optional(Type.String()),
});
export type CourseFilterInput = Static<typeof CourseFilterSchema>;

export const AddModuleSchema = Type.Object({
  title: MultilingualText,
  content: MultilingualText,
  sortOrder: Type.Optional(Type.Integer({ minimum: 0 })),
  durationMinutes: Type.Optional(Type.Integer({ minimum: 0 })),
});
export type AddModuleInput = Static<typeof AddModuleSchema>;

export const UpdateModuleSchema = Type.Object({
  title: Type.Optional(MultilingualText),
  content: Type.Optional(MultilingualText),
  sortOrder: Type.Optional(Type.Integer({ minimum: 0 })),
  durationMinutes: Type.Optional(Type.Integer({ minimum: 0 })),
});
export type UpdateModuleInput = Static<typeof UpdateModuleSchema>;

export const ReorderModulesSchema = Type.Object({
  moduleIds: Type.Array(Type.String({ format: 'uuid' })),
});
export type ReorderModulesInput = Static<typeof ReorderModulesSchema>;

export const ModuleIdParamSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  moduleId: Type.String({ format: 'uuid' }),
});
export type ModuleIdParamInput = Static<typeof ModuleIdParamSchema>;

// ── Public search ──

export const PublicSearchSchema = Type.Object({
  q: Type.Optional(Type.String()),
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50, default: 12 })),
  categoryId: Type.Optional(Type.String({ format: 'uuid' })),
  scope: Type.Optional(CategoryScopeEnum),
  scopeTenantId: Type.Optional(Type.String({ format: 'uuid' })),
  type: Type.Optional(PublicationTypeEnum),
  lang: Type.Optional(Type.String({ maxLength: 5 })),
});
export type PublicSearchInput = Static<typeof PublicSearchSchema>;

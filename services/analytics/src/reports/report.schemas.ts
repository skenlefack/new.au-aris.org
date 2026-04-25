/**
 * report.schemas.ts — Typebox schemas for report templates, reports, and flash strategies.
 */

import { Type, Static } from '@sinclair/typebox';

// ── Enums ──

export const ReportTypeSchema = Type.Union([
  Type.Literal('PERIODIC'),
  Type.Literal('FLASH'),
  Type.Literal('AD_HOC'),
]);

export const ReportStatusSchema = Type.Union([
  Type.Literal('DRAFT'),
  Type.Literal('GENERATING'),
  Type.Literal('AWAITING_REVIEW'),
  Type.Literal('PUBLISHED'),
  Type.Literal('FAILED'),
]);

export const SectionTypeSchema = Type.Union([
  Type.Literal('COVER'),
  Type.Literal('EXECUTIVE_SUMMARY'),
  Type.Literal('INDICATORS_TABLE'),
  Type.Literal('MAP_AND_TABLE'),
  Type.Literal('AI_GENERATED_FROM_DATA'),
  Type.Literal('RECOMMENDATIONS'),
  Type.Literal('ANNEX'),
  Type.Literal('FREE_TEXT'),
]);

export const SectionStatusSchema = Type.Union([
  Type.Literal('PENDING'),
  Type.Literal('GENERATED'),
  Type.Literal('AI_UNAVAILABLE'),
  Type.Literal('EDITED'),
  Type.Literal('APPROVED'),
]);

export const ReportScopeSchema = Type.Union([
  Type.Literal('CONTINENTAL'),
  Type.Literal('REGIONAL'),
  Type.Literal('NATIONAL'),
]);

export const ReportLanguageSchema = Type.Union([
  Type.Literal('fr'),
  Type.Literal('en'),
  Type.Literal('pt'),
  Type.Literal('ar'),
]);

// ── Template Section (stored in template JSONB) ──

export const TemplateSectionSchema = Type.Object({
  code: Type.String({ minLength: 1, maxLength: 50 }),
  titleFr: Type.String(),
  titleEn: Type.String(),
  sectionType: SectionTypeSchema,
  promptTemplate: Type.Optional(Type.String()),
  indicatorCodes: Type.Optional(Type.Array(Type.String())),
  displayOrder: Type.Integer({ minimum: 0 }),
  required: Type.Optional(Type.Boolean({ default: true })),
});

// ── Report Template ──

export const CreateReportTemplateSchema = Type.Object({
  code: Type.String({ minLength: 1, maxLength: 50 }),
  nameFr: Type.String({ minLength: 1 }),
  nameEn: Type.String({ minLength: 1 }),
  type: ReportTypeSchema,
  domainId: Type.Optional(Type.String({ format: 'uuid' })),
  scope: Type.Optional(ReportScopeSchema),
  descriptionFr: Type.Optional(Type.String()),
  descriptionEn: Type.Optional(Type.String()),
  sections: Type.Array(TemplateSectionSchema, { minItems: 1 }),
});
export type CreateReportTemplateDto = Static<typeof CreateReportTemplateSchema>;

export const UpdateReportTemplateSchema = Type.Partial(
  Type.Omit(CreateReportTemplateSchema, ['code']),
);
export type UpdateReportTemplateDto = Static<typeof UpdateReportTemplateSchema>;

// ── Generate Report ──

export const GenerateReportBodySchema = Type.Object({
  templateId: Type.String({ format: 'uuid' }),
  titleFr: Type.String({ minLength: 1 }),
  titleEn: Type.String({ minLength: 1 }),
  themeFr: Type.Optional(Type.String()),
  scope: ReportScopeSchema,
  domainId: Type.Optional(Type.String({ format: 'uuid' })),
  tenantId: Type.Optional(Type.String({ format: 'uuid' })),
  periodStart: Type.String({ format: 'date' }),
  periodEnd: Type.String({ format: 'date' }),
  referenceYear: Type.Optional(Type.Integer({ minimum: 2000, maximum: 2100 })),
  language: ReportLanguageSchema,
});
export type GenerateReportBody = Static<typeof GenerateReportBodySchema>;

// ── List Reports Query ──

export const ListReportsQuerySchema = Type.Object({
  type: Type.Optional(ReportTypeSchema),
  status: Type.Optional(ReportStatusSchema),
  domainId: Type.Optional(Type.String({ format: 'uuid' })),
  scope: Type.Optional(ReportScopeSchema),
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
});
export type ListReportsQuery = Static<typeof ListReportsQuerySchema>;

// ── Edit Section ──

export const EditSectionBodySchema = Type.Object({
  contentHtml: Type.String(),
});
export type EditSectionBody = Static<typeof EditSectionBodySchema>;

// ── Flash Strategy ──

export const CreateFlashStrategySchema = Type.Object({
  code: Type.String({ minLength: 1, maxLength: 50 }),
  nameFr: Type.String({ minLength: 1 }),
  nameEn: Type.String({ minLength: 1 }),
  domainId: Type.Optional(Type.String({ format: 'uuid' })),
  indicatorCode: Type.String({ minLength: 1 }),
  conditionType: Type.Union([
    Type.Literal('THRESHOLD_ABOVE'),
    Type.Literal('THRESHOLD_BELOW'),
    Type.Literal('PERCENT_CHANGE'),
    Type.Literal('ANOMALY'),
  ]),
  conditionValue: Type.Number(),
  templateId: Type.String({ format: 'uuid' }),
  cooldownMinutes: Type.Optional(Type.Integer({ minimum: 1, default: 60 })),
  active: Type.Optional(Type.Boolean({ default: true })),
});
export type CreateFlashStrategyDto = Static<typeof CreateFlashStrategySchema>;

export const UpdateFlashStrategySchema = Type.Partial(
  Type.Omit(CreateFlashStrategySchema, ['code']),
);
export type UpdateFlashStrategyDto = Static<typeof UpdateFlashStrategySchema>;

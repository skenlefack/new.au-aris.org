import { Type, Static } from '@sinclair/typebox';

// ── Enums (mirror Prisma) ──

export const IndicatorMeasurementModeSchema = Type.Union([
  Type.Literal('MANUAL_ENTRY'),
  Type.Literal('AUTO_FROM_FORM'),
  Type.Literal('AUTO_FROM_KPI_SOURCE'),
  Type.Literal('COMPOSITE_FORMULA'),
]);

export const IndicatorAggregationSchema = Type.Union([
  Type.Literal('SUM'),
  Type.Literal('AVERAGE'),
  Type.Literal('MIN'),
  Type.Literal('MAX'),
  Type.Literal('MEDIAN'),
  Type.Literal('COUNT'),
  Type.Literal('WEIGHTED_AVG'),
  Type.Literal('LATEST'),
  Type.Literal('CUSTOM'),
]);

export const IndicatorPeriodicitySchema = Type.Union([
  Type.Literal('DAILY'),
  Type.Literal('WEEKLY'),
  Type.Literal('MONTHLY'),
  Type.Literal('QUARTERLY'),
  Type.Literal('ANNUAL'),
  Type.Literal('ON_DEMAND'),
]);

export const IndicatorScopeSchema = Type.Union([
  Type.Literal('CONTINENTAL'),
  Type.Literal('REGIONAL'),
  Type.Literal('NATIONAL'),
  Type.Literal('SUB_NATIONAL'),
  Type.Literal('CROSS_CUTTING'),
]);

// ── Indicator Type ──

export const CreateIndicatorTypeSchema = Type.Object({
  code: Type.String({ minLength: 1, maxLength: 30 }),
  labelFr: Type.String({ minLength: 1 }),
  labelEn: Type.String({ minLength: 1 }),
  labelAr: Type.Optional(Type.String()),
  labelPt: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  color: Type.Optional(Type.String({ maxLength: 20 })),
  iconName: Type.Optional(Type.String({ maxLength: 50 })),
  externalRef: Type.Optional(Type.String()),
  displayOrder: Type.Optional(Type.Integer({ minimum: 0, default: 0 })),
});
export type CreateIndicatorTypeDto = Static<typeof CreateIndicatorTypeSchema>;

export const UpdateIndicatorTypeSchema = Type.Intersect([
  Type.Partial(Type.Omit(CreateIndicatorTypeSchema, ['code'])),
  Type.Object({ active: Type.Optional(Type.Boolean()) }),
]);
export type UpdateIndicatorTypeDto = Static<typeof UpdateIndicatorTypeSchema>;

// ── Indicator ──

export const CreateIndicatorSchema = Type.Object({
  code: Type.String({ minLength: 1, maxLength: 80 }),
  typeCode: Type.String({ minLength: 1, maxLength: 30 }),
  nameFr: Type.String({ minLength: 1 }),
  nameEn: Type.String({ minLength: 1 }),
  nameAr: Type.Optional(Type.String()),
  namePt: Type.Optional(Type.String()),
  descriptionFr: Type.Optional(Type.String()),
  descriptionEn: Type.Optional(Type.String()),
  descriptionAr: Type.Optional(Type.String()),
  descriptionPt: Type.Optional(Type.String()),
  domainId: Type.Optional(Type.String({ format: 'uuid' })),
  subDomainId: Type.Optional(Type.String({ format: 'uuid' })),
  valueChainCode: Type.Optional(Type.String({ maxLength: 30 })),
  scope: Type.Optional(IndicatorScopeSchema),
  measurementMode: Type.Optional(IndicatorMeasurementModeSchema),
  aggregation: Type.Optional(IndicatorAggregationSchema),
  periodicity: Type.Optional(IndicatorPeriodicitySchema),
  sourceFormId: Type.Optional(Type.String({ format: 'uuid' })),
  sourceFormFieldId: Type.Optional(Type.String({ maxLength: 100 })),
  externalSource: Type.Optional(Type.String({ maxLength: 100 })),
  unit: Type.Optional(Type.String({ maxLength: 30, default: 'count' })),
  decimalPlaces: Type.Optional(Type.Integer({ minimum: 0, default: 0 })),
  formatPattern: Type.Optional(Type.String({ maxLength: 50 })),
  targetValue: Type.Optional(Type.Number()),
  thresholds: Type.Optional(Type.Any()),
  betterIsHigher: Type.Optional(Type.Boolean({ default: true })),
  isPublic: Type.Optional(Type.Boolean({ default: false })),
  externalFrameworkReference: Type.Optional(Type.String({ maxLength: 255 })),
  notes: Type.Optional(Type.String()),
});
export type CreateIndicatorDto = Static<typeof CreateIndicatorSchema>;

export const UpdateIndicatorSchema = Type.Intersect([
  Type.Partial(Type.Omit(CreateIndicatorSchema, ['code'])),
  Type.Object({ active: Type.Optional(Type.Boolean()) }),
]);
export type UpdateIndicatorDto = Static<typeof UpdateIndicatorSchema>;

// ── Indicator Value ──

export const CreateIndicatorValueSchema = Type.Object({
  year: Type.Integer({ minimum: 1900, maximum: 2100 }),
  month: Type.Optional(Type.Integer({ minimum: 1, maximum: 12 })),
  quarter: Type.Optional(Type.Integer({ minimum: 1, maximum: 4 })),
  countryCode: Type.Optional(Type.String({ minLength: 2, maxLength: 2 })),
  recCode: Type.Optional(Type.String({ maxLength: 20 })),
  isContinental: Type.Optional(Type.Boolean({ default: false })),
  value: Type.Number(),
  source: Type.Optional(Type.String({ maxLength: 100 })),
  notes: Type.Optional(Type.String()),
});
export type CreateIndicatorValueDto = Static<typeof CreateIndicatorValueSchema>;

export const BulkIndicatorValueSchema = Type.Object({
  values: Type.Array(CreateIndicatorValueSchema, { minItems: 1, maxItems: 1000 }),
});
export type BulkIndicatorValueDto = Static<typeof BulkIndicatorValueSchema>;

// ── Formula ──

export const SetFormulaSchema = Type.Object({
  expression: Type.String({ minLength: 1 }),
  dependencies: Type.Array(
    Type.Object({
      indicatorCode: Type.String({ minLength: 1 }),
    }),
    { minItems: 1 },
  ),
});
export type SetFormulaDto = Static<typeof SetFormulaSchema>;

// ── Query params ──

export const IndicatorListQuerySchema = Type.Object({
  typeCode: Type.Optional(Type.String()),
  domainId: Type.Optional(Type.String()),
  subDomainId: Type.Optional(Type.String()),
  measurementMode: Type.Optional(IndicatorMeasurementModeSchema),
  active: Type.Optional(Type.Boolean()),
  search: Type.Optional(Type.String()),
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 200, default: 20 })),
});
export type IndicatorListQuery = Static<typeof IndicatorListQuerySchema>;

export const IndicatorValueQuerySchema = Type.Object({
  year: Type.Optional(Type.Integer()),
  countryCode: Type.Optional(Type.String()),
  recCode: Type.Optional(Type.String()),
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 200, default: 20 })),
});
export type IndicatorValueQuery = Static<typeof IndicatorValueQuerySchema>;

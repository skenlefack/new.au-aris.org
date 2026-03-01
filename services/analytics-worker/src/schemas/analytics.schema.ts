import { Type, Static } from '@sinclair/typebox';

const PeriodTypeEnum = Type.Union([
  Type.Literal('DAILY'),
  Type.Literal('WEEKLY'),
  Type.Literal('MONTHLY'),
  Type.Literal('QUARTERLY'),
  Type.Literal('YEARLY'),
]);

const DomainEnum = Type.Union([
  Type.Literal('health'),
  Type.Literal('livestock'),
  Type.Literal('fisheries'),
  Type.Literal('wildlife'),
  Type.Literal('apiculture'),
  Type.Literal('trade'),
  Type.Literal('governance'),
  Type.Literal('climate'),
  Type.Literal('collecte'),
  Type.Literal('quality'),
]);

// ── KPI Query ──
export const KpiQuerystring = Type.Object({
  domain: Type.Optional(Type.String()),
  periodType: Type.Optional(PeriodTypeEnum),
  tenantId: Type.Optional(Type.String({ format: 'uuid' })),
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
});
export type KpiQuery = Static<typeof KpiQuerystring>;

export const KpiQuerySchema = { querystring: KpiQuerystring };

// ── Domain Param ──
export const DomainParam = Type.Object({ domain: Type.String() });
export const DomainParamSchema = { params: DomainParam };

// ── Aggregate Request ──
export const AggregateBody = Type.Object({
  domains: Type.Array(Type.String(), { minItems: 1 }),
  periodType: Type.Optional(PeriodTypeEnum),
  force: Type.Optional(Type.Boolean()),
});
export type AggregateRequest = Static<typeof AggregateBody>;

export const AggregateSchema = { body: AggregateBody };

// ── Dashboard Query ──
export const DashboardQuerystring = Type.Object({
  periodType: Type.Optional(PeriodTypeEnum),
});
export type DashboardQuery = Static<typeof DashboardQuerystring>;

export const DashboardSchema = { querystring: DashboardQuerystring };

// ── Worker State Query ──
export const WorkerStateQuerystring = Type.Object({
  consumerGroup: Type.Optional(Type.String()),
});
export type WorkerStateQuery = Static<typeof WorkerStateQuerystring>;

export const WorkerStateSchema = { querystring: WorkerStateQuerystring };

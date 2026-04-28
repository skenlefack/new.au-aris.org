import { Type, type Static } from '@sinclair/typebox';

// ─── Enums ───────────────────────────────────────────────────────────────────

const SubDomainTypeEnum = Type.Union([
  Type.Literal('VALUE_CHAIN'),
  Type.Literal('ORGANIZATIONAL'),
  Type.Literal('PATHOLOGY'),
  Type.Literal('OTHER'),
]);

// ─── Admin CRUD schemas ──────────────────────────────────────────────────────

export const CreateSubDomainSchema = Type.Object({
  code: Type.String({ minLength: 1, maxLength: 50 }),
  domainCode: Type.String({ minLength: 1, maxLength: 30 }),
  valueChainCode: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  labelFr: Type.String({ minLength: 1 }),
  labelEn: Type.String({ minLength: 1 }),
  labelAr: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  labelPt: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  typeEnum: SubDomainTypeEnum,
  active: Type.Optional(Type.Boolean()),
  displayOrder: Type.Optional(Type.Integer({ minimum: 0 })),
  description: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  icon: Type.Optional(Type.Union([Type.String({ maxLength: 50 }), Type.Null()])),
  color: Type.Optional(Type.Union([Type.String({ maxLength: 20 }), Type.Null()])),
});

export const UpdateSubDomainSchema = Type.Object({
  labelFr: Type.Optional(Type.String({ minLength: 1 })),
  labelEn: Type.Optional(Type.String({ minLength: 1 })),
  labelAr: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  labelPt: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  valueChainCode: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  typeEnum: Type.Optional(SubDomainTypeEnum),
  active: Type.Optional(Type.Boolean()),
  displayOrder: Type.Optional(Type.Integer({ minimum: 0 })),
  description: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  icon: Type.Optional(Type.Union([Type.String({ maxLength: 50 }), Type.Null()])),
  color: Type.Optional(Type.Union([Type.String({ maxLength: 20 }), Type.Null()])),
});

// ─── Params ──────────────────────────────────────────────────────────────────

export const SubDomainIdParamSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
});

export const DomainCodeParamSchema = Type.Object({
  code: Type.String({ minLength: 1 }),
});

export const ValueChainCodeParamSchema = Type.Object({
  code: Type.String({ minLength: 1 }),
});

// ─── Query filters ───────────────────────────────────────────────────────────

export const SubDomainListQuerySchema = Type.Object({
  domainCode: Type.Optional(Type.String()),
  typeEnum: Type.Optional(SubDomainTypeEnum),
  active: Type.Optional(Type.Union([Type.Literal('true'), Type.Literal('false')])),
  valueChainCode: Type.Optional(Type.String()),
  search: Type.Optional(Type.String()),
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 500 })),
});

// ─── Types ───────────────────────────────────────────────────────────────────

export type CreateSubDomainInput = Static<typeof CreateSubDomainSchema>;
export type UpdateSubDomainInput = Static<typeof UpdateSubDomainSchema>;
export type SubDomainIdParam = Static<typeof SubDomainIdParamSchema>;
export type DomainCodeParam = Static<typeof DomainCodeParamSchema>;
export type ValueChainCodeParam = Static<typeof ValueChainCodeParamSchema>;
export type SubDomainListQuery = Static<typeof SubDomainListQuerySchema>;

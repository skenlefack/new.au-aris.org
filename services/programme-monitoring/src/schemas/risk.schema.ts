import { Type, type Static } from '@sinclair/typebox';

const MultilingualText = Type.Object({
  en: Type.String({ minLength: 1 }),
  fr: Type.Optional(Type.String()),
  pt: Type.Optional(Type.String()),
  ar: Type.Optional(Type.String()),
});

const CategoryEnum = Type.Union([
  Type.Literal('FINANCIAL'),
  Type.Literal('TECHNICAL'),
  Type.Literal('OPERATIONAL'),
  Type.Literal('POLITICAL'),
  Type.Literal('SECURITY'),
]);

const LikelihoodEnum = Type.Union([
  Type.Literal('LOW'),
  Type.Literal('MEDIUM'),
  Type.Literal('HIGH'),
  Type.Literal('VERY_HIGH'),
]);

const ImpactEnum = Type.Union([
  Type.Literal('LOW'),
  Type.Literal('MEDIUM'),
  Type.Literal('HIGH'),
  Type.Literal('CRITICAL'),
]);

const RiskStatusEnum = Type.Union([
  Type.Literal('OPEN'),
  Type.Literal('MITIGATED'),
  Type.Literal('MATERIALIZED'),
  Type.Literal('CLOSED'),
]);

export const CreateRiskSchema = Type.Object({
  code: Type.String({ minLength: 1, maxLength: 20 }),
  description: MultilingualText,
  category: CategoryEnum,
  likelihood: LikelihoodEnum,
  impact: ImpactEnum,
  mitigation: Type.Optional(MultilingualText),
  ownerUserId: Type.Optional(Type.String({ format: 'uuid' })),
});

export const UpdateRiskSchema = Type.Object({
  code: Type.Optional(Type.String({ maxLength: 20 })),
  description: Type.Optional(MultilingualText),
  category: Type.Optional(CategoryEnum),
  likelihood: Type.Optional(LikelihoodEnum),
  impact: Type.Optional(ImpactEnum),
  mitigation: Type.Optional(MultilingualText),
  ownerUserId: Type.Optional(Type.String({ format: 'uuid' })),
  status: Type.Optional(RiskStatusEnum),
  lastReviewDate: Type.Optional(Type.String({ format: 'date' })),
});

export const TeamMemberSchema = Type.Object({
  userId: Type.String({ format: 'uuid' }),
  role: Type.Union([
    Type.Literal('PROGRAMME_DIRECTOR'),
    Type.Literal('PROGRAMME_COORDINATOR'),
    Type.Literal('REGIONAL_COORDINATOR'),
    Type.Literal('ACTIVITY_OWNER'),
    Type.Literal('M_AND_E_OFFICER'),
    Type.Literal('FINANCE_OFFICER'),
    Type.Literal('VIEWER'),
  ]),
  geoEntityId: Type.Optional(Type.String({ format: 'uuid' })),
});

export type CreateRiskInput = Static<typeof CreateRiskSchema>;
export type UpdateRiskInput = Static<typeof UpdateRiskSchema>;
export type TeamMemberInput = Static<typeof TeamMemberSchema>;

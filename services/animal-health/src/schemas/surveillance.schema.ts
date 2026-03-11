import { Type, type Static } from '@sinclair/typebox';

export const CreateSurveillanceSchema = Type.Object({
  type: Type.String(), // PASSIVE | ACTIVE | SENTINEL | EVENT_BASED
  diseaseId: Type.String({ format: 'uuid' }),
  designType: Type.Optional(Type.String()), // CLUSTER | RISK_BASED | RANDOM
  sampleSize: Type.Integer({ minimum: 0, default: 0 }),
  positivityRate: Type.Optional(Type.Number({ minimum: 0, maximum: 100 })),
  periodStart: Type.String({ format: 'date-time' }),
  periodEnd: Type.String({ format: 'date-time' }),
  geoEntityId: Type.String({ format: 'uuid' }),
  mapLayerId: Type.Optional(Type.String({ format: 'uuid' })),
  dataClassification: Type.Optional(Type.String()),
});

export const UpdateSurveillanceSchema = Type.Object({
  type: Type.Optional(Type.String()),
  designType: Type.Optional(Type.String()),
  sampleSize: Type.Optional(Type.Integer({ minimum: 0 })),
  positivityRate: Type.Optional(Type.Number({ minimum: 0, maximum: 100 })),
  periodStart: Type.Optional(Type.String({ format: 'date-time' })),
  periodEnd: Type.Optional(Type.String({ format: 'date-time' })),
  dataClassification: Type.Optional(Type.String()),
});

export const SurveillanceFilterSchema = Type.Object({
  type: Type.Optional(Type.String()),
  diseaseId: Type.Optional(Type.String({ format: 'uuid' })),
  periodStart: Type.Optional(Type.String({ format: 'date-time' })),
  periodEnd: Type.Optional(Type.String({ format: 'date-time' })),
});

export type CreateSurveillanceInput = Static<typeof CreateSurveillanceSchema>;
export type UpdateSurveillanceInput = Static<typeof UpdateSurveillanceSchema>;
export type SurveillanceFilterInput = Static<typeof SurveillanceFilterSchema>;

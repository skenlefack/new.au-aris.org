import { Type, type Static } from '@sinclair/typebox';

export const CreateHealthEventSchema = Type.Object({
  diseaseId: Type.String({ format: 'uuid' }),
  eventType: Type.String(), // SUSPECT | CONFIRMED | RESOLVED
  speciesIds: Type.Array(Type.String({ format: 'uuid' }), { minItems: 1 }),
  dateOnset: Type.Optional(Type.String({ format: 'date-time' })),
  dateSuspicion: Type.String({ format: 'date-time' }),
  dateConfirmation: Type.Optional(Type.String({ format: 'date-time' })),
  dateClosure: Type.Optional(Type.String({ format: 'date-time' })),
  geoEntityId: Type.String({ format: 'uuid' }),
  latitude: Type.Optional(Type.Number({ minimum: -90, maximum: 90 })),
  longitude: Type.Optional(Type.Number({ minimum: -180, maximum: 180 })),
  holdingsAffected: Type.Integer({ minimum: 0, default: 0 }),
  susceptible: Type.Integer({ minimum: 0, default: 0 }),
  cases: Type.Integer({ minimum: 0, default: 0 }),
  deaths: Type.Integer({ minimum: 0, default: 0 }),
  killed: Type.Integer({ minimum: 0, default: 0 }),
  slaughtered: Type.Integer({ minimum: 0, default: 0 }),
  controlMeasures: Type.Optional(Type.Array(Type.String())),
  confidenceLevel: Type.String(), // RUMOR | VERIFIED | CONFIRMED
  dataClassification: Type.Optional(Type.String()),
});

export const UpdateHealthEventSchema = Type.Object({
  eventType: Type.Optional(Type.String()),
  speciesIds: Type.Optional(Type.Array(Type.String({ format: 'uuid' }))),
  dateOnset: Type.Optional(Type.String({ format: 'date-time' })),
  dateConfirmation: Type.Optional(Type.String({ format: 'date-time' })),
  dateClosure: Type.Optional(Type.String({ format: 'date-time' })),
  holdingsAffected: Type.Optional(Type.Integer({ minimum: 0 })),
  susceptible: Type.Optional(Type.Integer({ minimum: 0 })),
  cases: Type.Optional(Type.Integer({ minimum: 0 })),
  deaths: Type.Optional(Type.Integer({ minimum: 0 })),
  killed: Type.Optional(Type.Integer({ minimum: 0 })),
  slaughtered: Type.Optional(Type.Integer({ minimum: 0 })),
  controlMeasures: Type.Optional(Type.Array(Type.String())),
  confidenceLevel: Type.Optional(Type.String()),
  dataClassification: Type.Optional(Type.String()),
});

export const HealthEventFilterSchema = Type.Object({
  diseaseId: Type.Optional(Type.String({ format: 'uuid' })),
  status: Type.Optional(Type.String()),
  speciesId: Type.Optional(Type.String({ format: 'uuid' })),
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

export type CreateHealthEventInput = Static<typeof CreateHealthEventSchema>;
export type UpdateHealthEventInput = Static<typeof UpdateHealthEventSchema>;
export type HealthEventFilterInput = Static<typeof HealthEventFilterSchema>;
export type PaginationQueryInput = Static<typeof PaginationQuerySchema>;
export type UuidParamInput = Static<typeof UuidParamSchema>;

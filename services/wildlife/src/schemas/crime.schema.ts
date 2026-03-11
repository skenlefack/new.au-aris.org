import { Type, type Static } from '@sinclair/typebox';

export const CreateCrimeSchema = Type.Object({
  incidentDate: Type.String({ format: 'date-time' }),
  geoEntityId: Type.String({ format: 'uuid' }),
  coordinates: Type.Optional(Type.Unknown()),
  crimeType: Type.String({ minLength: 1, maxLength: 100 }),
  speciesIds: Type.Array(Type.String({ format: 'uuid' }), { minItems: 1 }),
  description: Type.String({ minLength: 1 }),
  suspectsCount: Type.Optional(Type.Integer({ minimum: 0 })),
  seizureDescription: Type.Optional(Type.String()),
  seizureQuantity: Type.Optional(Type.Number({ minimum: 0 })),
  seizureUnit: Type.Optional(Type.String({ maxLength: 50 })),
  status: Type.Optional(Type.String({ maxLength: 50 })),
  reportingAgency: Type.String({ minLength: 1, maxLength: 255 }),
  dataClassification: Type.Optional(Type.String()),
});

export const UpdateCrimeSchema = Type.Object({
  incidentDate: Type.Optional(Type.String({ format: 'date-time' })),
  geoEntityId: Type.Optional(Type.String({ format: 'uuid' })),
  coordinates: Type.Optional(Type.Unknown()),
  crimeType: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
  speciesIds: Type.Optional(Type.Array(Type.String({ format: 'uuid' }), { minItems: 1 })),
  description: Type.Optional(Type.String({ minLength: 1 })),
  suspectsCount: Type.Optional(Type.Integer({ minimum: 0 })),
  seizureDescription: Type.Optional(Type.String()),
  seizureQuantity: Type.Optional(Type.Number({ minimum: 0 })),
  seizureUnit: Type.Optional(Type.String({ maxLength: 50 })),
  status: Type.Optional(Type.String({ maxLength: 50 })),
  reportingAgency: Type.Optional(Type.String({ minLength: 1, maxLength: 255 })),
  dataClassification: Type.Optional(Type.String()),
});

export const CrimeFilterSchema = Type.Object({
  geoEntityId: Type.Optional(Type.String({ format: 'uuid' })),
  crimeType: Type.Optional(Type.String()),
  status: Type.Optional(Type.String()),
  reportingAgency: Type.Optional(Type.String()),
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

export type CreateCrimeInput = Static<typeof CreateCrimeSchema>;
export type UpdateCrimeInput = Static<typeof UpdateCrimeSchema>;
export type CrimeFilterInput = Static<typeof CrimeFilterSchema>;
export type PaginationQueryInput = Static<typeof PaginationQuerySchema>;
export type UuidParamInput = Static<typeof UuidParamSchema>;

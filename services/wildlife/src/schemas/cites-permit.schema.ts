import { Type, type Static } from '@sinclair/typebox';

export const CreateCitesPermitSchema = Type.Object({
  permitNumber: Type.String({ minLength: 1, maxLength: 100 }),
  permitType: Type.String({ minLength: 1, maxLength: 50 }),
  speciesId: Type.String({ format: 'uuid' }),
  quantity: Type.Integer({ minimum: 1 }),
  unit: Type.String({ minLength: 1, maxLength: 50 }),
  purpose: Type.String({ minLength: 1, maxLength: 255 }),
  applicant: Type.String({ minLength: 1, maxLength: 255 }),
  exportCountry: Type.String({ minLength: 2, maxLength: 3 }),
  importCountry: Type.String({ minLength: 2, maxLength: 3 }),
  issueDate: Type.String({ format: 'date-time' }),
  expiryDate: Type.String({ format: 'date-time' }),
  status: Type.Optional(Type.String({ maxLength: 50 })),
  dataClassification: Type.Optional(Type.String()),
});

export const UpdateCitesPermitSchema = Type.Object({
  permitNumber: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
  permitType: Type.Optional(Type.String({ minLength: 1, maxLength: 50 })),
  speciesId: Type.Optional(Type.String({ format: 'uuid' })),
  quantity: Type.Optional(Type.Integer({ minimum: 1 })),
  unit: Type.Optional(Type.String({ minLength: 1, maxLength: 50 })),
  purpose: Type.Optional(Type.String({ minLength: 1, maxLength: 255 })),
  applicant: Type.Optional(Type.String({ minLength: 1, maxLength: 255 })),
  exportCountry: Type.Optional(Type.String({ minLength: 2, maxLength: 3 })),
  importCountry: Type.Optional(Type.String({ minLength: 2, maxLength: 3 })),
  issueDate: Type.Optional(Type.String({ format: 'date-time' })),
  expiryDate: Type.Optional(Type.String({ format: 'date-time' })),
  status: Type.Optional(Type.String({ maxLength: 50 })),
  dataClassification: Type.Optional(Type.String()),
});

export const CitesPermitFilterSchema = Type.Object({
  speciesId: Type.Optional(Type.String({ format: 'uuid' })),
  permitType: Type.Optional(Type.String()),
  status: Type.Optional(Type.String()),
  exportCountry: Type.Optional(Type.String()),
  importCountry: Type.Optional(Type.String()),
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

export type CreateCitesPermitInput = Static<typeof CreateCitesPermitSchema>;
export type UpdateCitesPermitInput = Static<typeof UpdateCitesPermitSchema>;
export type CitesPermitFilterInput = Static<typeof CitesPermitFilterSchema>;
export type PaginationQueryInput = Static<typeof PaginationQuerySchema>;
export type UuidParamInput = Static<typeof UuidParamSchema>;

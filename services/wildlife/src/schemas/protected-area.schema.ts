import { Type, type Static } from '@sinclair/typebox';

export const CreateProtectedAreaSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 255 }),
  wdpaId: Type.Optional(Type.String({ maxLength: 50 })),
  iucnCategory: Type.String({ minLength: 1, maxLength: 50 }),
  geoEntityId: Type.String({ format: 'uuid' }),
  areaKm2: Type.Number({ minimum: 0 }),
  designationDate: Type.Optional(Type.String({ format: 'date-time' })),
  managingAuthority: Type.String({ minLength: 1, maxLength: 255 }),
  coordinates: Type.Optional(Type.Unknown()),
  isActive: Type.Optional(Type.Boolean()),
  dataClassification: Type.Optional(Type.String()),
});

export const UpdateProtectedAreaSchema = Type.Object({
  name: Type.Optional(Type.String({ minLength: 1, maxLength: 255 })),
  wdpaId: Type.Optional(Type.String({ maxLength: 50 })),
  iucnCategory: Type.Optional(Type.String({ minLength: 1, maxLength: 50 })),
  geoEntityId: Type.Optional(Type.String({ format: 'uuid' })),
  areaKm2: Type.Optional(Type.Number({ minimum: 0 })),
  designationDate: Type.Optional(Type.String({ format: 'date-time' })),
  managingAuthority: Type.Optional(Type.String({ minLength: 1, maxLength: 255 })),
  coordinates: Type.Optional(Type.Unknown()),
  isActive: Type.Optional(Type.Boolean()),
  dataClassification: Type.Optional(Type.String()),
});

export const ProtectedAreaFilterSchema = Type.Object({
  geoEntityId: Type.Optional(Type.String({ format: 'uuid' })),
  iucnCategory: Type.Optional(Type.String()),
  managingAuthority: Type.Optional(Type.String()),
  isActive: Type.Optional(Type.Boolean()),
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

export type CreateProtectedAreaInput = Static<typeof CreateProtectedAreaSchema>;
export type UpdateProtectedAreaInput = Static<typeof UpdateProtectedAreaSchema>;
export type ProtectedAreaFilterInput = Static<typeof ProtectedAreaFilterSchema>;
export type PaginationQueryInput = Static<typeof PaginationQuerySchema>;
export type UuidParamInput = Static<typeof UuidParamSchema>;

import { Type, type Static } from '@sinclair/typebox';

export const CreateVesselSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 255 }),
  registrationNumber: Type.String({ minLength: 1, maxLength: 100 }),
  flagState: Type.String({ minLength: 1, maxLength: 100 }),
  vesselType: Type.String({ minLength: 1, maxLength: 100 }),
  lengthMeters: Type.Number({ minimum: 0 }),
  tonnageGt: Type.Number({ minimum: 0 }),
  homePort: Type.String({ minLength: 1, maxLength: 255 }),
  licenseNumber: Type.Optional(Type.String({ maxLength: 100 })),
  licenseExpiry: Type.Optional(Type.String({ format: 'date-time' })),
  dataClassification: Type.Optional(Type.String()),
});

export const UpdateVesselSchema = Type.Object({
  name: Type.Optional(Type.String({ minLength: 1, maxLength: 255 })),
  registrationNumber: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
  flagState: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
  vesselType: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
  lengthMeters: Type.Optional(Type.Number({ minimum: 0 })),
  tonnageGt: Type.Optional(Type.Number({ minimum: 0 })),
  homePort: Type.Optional(Type.String({ minLength: 1, maxLength: 255 })),
  licenseNumber: Type.Optional(Type.String({ maxLength: 100 })),
  licenseExpiry: Type.Optional(Type.String({ format: 'date-time' })),
  isActive: Type.Optional(Type.Boolean()),
  dataClassification: Type.Optional(Type.String()),
});

export const VesselFilterSchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  sort: Type.Optional(Type.String()),
  order: Type.Optional(Type.Union([Type.Literal('asc'), Type.Literal('desc')])),
  vesselType: Type.Optional(Type.String()),
  portOfRegistry: Type.Optional(Type.String()),
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

export type CreateVesselInput = Static<typeof CreateVesselSchema>;
export type UpdateVesselInput = Static<typeof UpdateVesselSchema>;
export type VesselFilterInput = Static<typeof VesselFilterSchema>;
export type PaginationQueryInput = Static<typeof PaginationQuerySchema>;
export type UuidParamInput = Static<typeof UuidParamSchema>;

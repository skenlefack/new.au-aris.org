import { Type, type Static } from '@sinclair/typebox';

export const CreateCaptureSchema = Type.Object({
  speciesId: Type.String({ format: 'uuid' }),
  faoAreaCode: Type.String({ minLength: 1, maxLength: 20 }),
  gearType: Type.String({ minLength: 1, maxLength: 100 }),
  quantityKg: Type.Number({ minimum: 0 }),
  landingSite: Type.String({ minLength: 1, maxLength: 255 }),
  vesselId: Type.Optional(Type.String({ format: 'uuid' })),
  captureDate: Type.String({ format: 'date-time' }),
  geoEntityId: Type.String({ format: 'uuid' }),
  dataClassification: Type.Optional(Type.String()),
});

export const UpdateCaptureSchema = Type.Object({
  speciesId: Type.Optional(Type.String({ format: 'uuid' })),
  faoAreaCode: Type.Optional(Type.String({ minLength: 1, maxLength: 20 })),
  gearType: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
  quantityKg: Type.Optional(Type.Number({ minimum: 0 })),
  landingSite: Type.Optional(Type.String({ minLength: 1, maxLength: 255 })),
  vesselId: Type.Optional(Type.String({ format: 'uuid' })),
  captureDate: Type.Optional(Type.String({ format: 'date-time' })),
  geoEntityId: Type.Optional(Type.String({ format: 'uuid' })),
  dataClassification: Type.Optional(Type.String()),
});

export const CaptureFilterSchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  sort: Type.Optional(Type.String()),
  order: Type.Optional(Type.Union([Type.Literal('asc'), Type.Literal('desc')])),
  speciesId: Type.Optional(Type.String({ format: 'uuid' })),
  faoAreaCode: Type.Optional(Type.String()),
  gearType: Type.Optional(Type.String()),
  vesselId: Type.Optional(Type.String({ format: 'uuid' })),
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

export type CreateCaptureInput = Static<typeof CreateCaptureSchema>;
export type UpdateCaptureInput = Static<typeof UpdateCaptureSchema>;
export type CaptureFilterInput = Static<typeof CaptureFilterSchema>;
export type PaginationQueryInput = Static<typeof PaginationQuerySchema>;
export type UuidParamInput = Static<typeof UuidParamSchema>;

import { Type, type Static } from '@sinclair/typebox';

export const CreateAquacultureProductionSchema = Type.Object({
  farmId: Type.String({ format: 'uuid' }),
  speciesId: Type.String({ format: 'uuid' }),
  quantityKg: Type.Number({ minimum: 0 }),
  harvestDate: Type.String({ format: 'date-time' }),
  methodOfCulture: Type.String({ minLength: 1, maxLength: 100 }),
  feedUsedKg: Type.Optional(Type.Number({ minimum: 0 })),
  fcr: Type.Optional(Type.Number({ minimum: 0 })),
  batchId: Type.Optional(Type.String({ maxLength: 100 })),
  dataClassification: Type.Optional(Type.String()),
});

export const UpdateAquacultureProductionSchema = Type.Object({
  farmId: Type.Optional(Type.String({ format: 'uuid' })),
  speciesId: Type.Optional(Type.String({ format: 'uuid' })),
  quantityKg: Type.Optional(Type.Number({ minimum: 0 })),
  harvestDate: Type.Optional(Type.String({ format: 'date-time' })),
  methodOfCulture: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
  feedUsedKg: Type.Optional(Type.Number({ minimum: 0 })),
  fcr: Type.Optional(Type.Number({ minimum: 0 })),
  batchId: Type.Optional(Type.String({ maxLength: 100 })),
  dataClassification: Type.Optional(Type.String()),
});

export const AquacultureProductionFilterSchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  sort: Type.Optional(Type.String()),
  order: Type.Optional(Type.Union([Type.Literal('asc'), Type.Literal('desc')])),
  farmId: Type.Optional(Type.String({ format: 'uuid' })),
  speciesId: Type.Optional(Type.String({ format: 'uuid' })),
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

export type CreateAquacultureProductionInput = Static<typeof CreateAquacultureProductionSchema>;
export type UpdateAquacultureProductionInput = Static<typeof UpdateAquacultureProductionSchema>;
export type AquacultureProductionFilterInput = Static<typeof AquacultureProductionFilterSchema>;
export type PaginationQueryInput = Static<typeof PaginationQuerySchema>;
export type UuidParamInput = Static<typeof UuidParamSchema>;

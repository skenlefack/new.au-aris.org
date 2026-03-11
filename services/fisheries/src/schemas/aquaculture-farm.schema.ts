import { Type, type Static } from '@sinclair/typebox';

export const CreateAquacultureFarmSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 255 }),
  farmType: Type.String({ minLength: 1, maxLength: 100 }),
  waterSource: Type.String({ minLength: 1, maxLength: 100 }),
  areaHectares: Type.Number({ minimum: 0 }),
  speciesIds: Type.Array(Type.String({ format: 'uuid' }), { minItems: 1 }),
  productionCapacityTonnes: Type.Number({ minimum: 0 }),
  geoEntityId: Type.String({ format: 'uuid' }),
  coordinates: Type.Optional(Type.Object({}, { additionalProperties: true })),
  dataClassification: Type.Optional(Type.String()),
});

export const UpdateAquacultureFarmSchema = Type.Object({
  name: Type.Optional(Type.String({ minLength: 1, maxLength: 255 })),
  farmType: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
  waterSource: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
  areaHectares: Type.Optional(Type.Number({ minimum: 0 })),
  speciesIds: Type.Optional(Type.Array(Type.String({ format: 'uuid' }), { minItems: 1 })),
  productionCapacityTonnes: Type.Optional(Type.Number({ minimum: 0 })),
  geoEntityId: Type.Optional(Type.String({ format: 'uuid' })),
  coordinates: Type.Optional(Type.Object({}, { additionalProperties: true })),
  isActive: Type.Optional(Type.Boolean()),
  dataClassification: Type.Optional(Type.String()),
});

export const AquacultureFarmFilterSchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  sort: Type.Optional(Type.String()),
  order: Type.Optional(Type.Union([Type.Literal('asc'), Type.Literal('desc')])),
  farmType: Type.Optional(Type.String()),
  waterType: Type.Optional(Type.String()),
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

export type CreateAquacultureFarmInput = Static<typeof CreateAquacultureFarmSchema>;
export type UpdateAquacultureFarmInput = Static<typeof UpdateAquacultureFarmSchema>;
export type AquacultureFarmFilterInput = Static<typeof AquacultureFarmFilterSchema>;
export type PaginationQueryInput = Static<typeof PaginationQuerySchema>;
export type UuidParamInput = Static<typeof UuidParamSchema>;

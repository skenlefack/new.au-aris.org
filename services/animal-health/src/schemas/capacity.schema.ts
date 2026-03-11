import { Type, type Static } from '@sinclair/typebox';

export const CreateCapacitySchema = Type.Object({
  year: Type.Integer({ minimum: 2000, maximum: 2100 }),
  epiStaff: Type.Integer({ minimum: 0, default: 0 }),
  labStaff: Type.Integer({ minimum: 0, default: 0 }),
  labTestsAvailable: Type.Array(Type.String()),
  vaccineProductionCapacity: Type.Optional(Type.Integer({ minimum: 0 })),
  pvsScore: Type.Optional(Type.Number({ minimum: 0, maximum: 5 })),
  dataClassification: Type.Optional(Type.String()),
});

export const UpdateCapacitySchema = Type.Object({
  epiStaff: Type.Optional(Type.Integer({ minimum: 0 })),
  labStaff: Type.Optional(Type.Integer({ minimum: 0 })),
  labTestsAvailable: Type.Optional(Type.Array(Type.String())),
  vaccineProductionCapacity: Type.Optional(Type.Integer({ minimum: 0 })),
  pvsScore: Type.Optional(Type.Number({ minimum: 0, maximum: 5 })),
  dataClassification: Type.Optional(Type.String()),
});

export const CapacityFilterSchema = Type.Object({
  year: Type.Optional(Type.Integer({ minimum: 2000, maximum: 2100 })),
});

export type CreateCapacityInput = Static<typeof CreateCapacitySchema>;
export type UpdateCapacityInput = Static<typeof UpdateCapacitySchema>;
export type CapacityFilterInput = Static<typeof CapacityFilterSchema>;

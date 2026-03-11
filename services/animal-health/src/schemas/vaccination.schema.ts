import { Type, type Static } from '@sinclair/typebox';

export const CreateVaccinationSchema = Type.Object({
  diseaseId: Type.String({ format: 'uuid' }),
  speciesId: Type.String({ format: 'uuid' }),
  vaccineType: Type.String({ minLength: 1, maxLength: 200 }),
  vaccineBatch: Type.Optional(Type.String({ maxLength: 100 })),
  dosesDelivered: Type.Integer({ minimum: 0, default: 0 }),
  dosesUsed: Type.Integer({ minimum: 0, default: 0 }),
  targetPopulation: Type.Integer({ minimum: 0, default: 0 }),
  pveSerologyDone: Type.Boolean({ default: false }),
  periodStart: Type.String({ format: 'date-time' }),
  periodEnd: Type.String({ format: 'date-time' }),
  geoEntityId: Type.String({ format: 'uuid' }),
  dataClassification: Type.Optional(Type.String()),
});

export const UpdateVaccinationSchema = Type.Object({
  vaccineType: Type.Optional(Type.String({ minLength: 1, maxLength: 200 })),
  vaccineBatch: Type.Optional(Type.String({ maxLength: 100 })),
  dosesDelivered: Type.Optional(Type.Integer({ minimum: 0 })),
  dosesUsed: Type.Optional(Type.Integer({ minimum: 0 })),
  targetPopulation: Type.Optional(Type.Integer({ minimum: 0 })),
  pveSerologyDone: Type.Optional(Type.Boolean()),
  periodStart: Type.Optional(Type.String({ format: 'date-time' })),
  periodEnd: Type.Optional(Type.String({ format: 'date-time' })),
  dataClassification: Type.Optional(Type.String()),
});

export const VaccinationFilterSchema = Type.Object({
  diseaseId: Type.Optional(Type.String({ format: 'uuid' })),
  speciesId: Type.Optional(Type.String({ format: 'uuid' })),
  periodStart: Type.Optional(Type.String({ format: 'date-time' })),
  periodEnd: Type.Optional(Type.String({ format: 'date-time' })),
});

export type CreateVaccinationInput = Static<typeof CreateVaccinationSchema>;
export type UpdateVaccinationInput = Static<typeof UpdateVaccinationSchema>;
export type VaccinationFilterInput = Static<typeof VaccinationFilterSchema>;

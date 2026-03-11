import { Type, type Static } from '@sinclair/typebox';

export const CreateLabResultSchema = Type.Object({
  sampleId: Type.String({ minLength: 1, maxLength: 100 }),
  sampleType: Type.String({ minLength: 1, maxLength: 100 }),
  dateCollected: Type.String({ format: 'date-time' }),
  dateReceived: Type.String({ format: 'date-time' }),
  testType: Type.String({ minLength: 1, maxLength: 100 }),
  result: Type.String(), // POSITIVE | NEGATIVE | INCONCLUSIVE
  labId: Type.String({ format: 'uuid' }),
  turnaroundDays: Type.Integer({ minimum: 0, default: 0 }),
  eqaFlag: Type.Boolean({ default: false }),
  healthEventId: Type.Optional(Type.String({ format: 'uuid' })),
  dataClassification: Type.Optional(Type.String()),
});

export const UpdateLabResultSchema = Type.Object({
  sampleType: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
  testType: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
  result: Type.Optional(Type.String()),
  turnaroundDays: Type.Optional(Type.Integer({ minimum: 0 })),
  eqaFlag: Type.Optional(Type.Boolean()),
  dataClassification: Type.Optional(Type.String()),
});

export const LabResultFilterSchema = Type.Object({
  healthEventId: Type.Optional(Type.String({ format: 'uuid' })),
  labId: Type.Optional(Type.String({ format: 'uuid' })),
  result: Type.Optional(Type.String()),
  periodStart: Type.Optional(Type.String({ format: 'date-time' })),
  periodEnd: Type.Optional(Type.String({ format: 'date-time' })),
});

export type CreateLabResultInput = Static<typeof CreateLabResultSchema>;
export type UpdateLabResultInput = Static<typeof UpdateLabResultSchema>;
export type LabResultFilterInput = Static<typeof LabResultFilterSchema>;

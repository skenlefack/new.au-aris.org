import { Type, type Static } from '@sinclair/typebox';

export const CreateTrainingSchema = Type.Object({
  beekeeperId: Type.String({ minLength: 1, maxLength: 255 }),
  trainingType: Type.String({ minLength: 1, maxLength: 255 }),
  completedDate: Type.String({ format: 'date-time' }),
  certificationNumber: Type.Optional(Type.String({ minLength: 1, maxLength: 255 })),
  dataClassification: Type.Optional(
    Type.Union([
      Type.Literal('PUBLIC'),
      Type.Literal('PARTNER'),
      Type.Literal('RESTRICTED'),
      Type.Literal('CONFIDENTIAL'),
    ]),
  ),
});
export type CreateTrainingInput = Static<typeof CreateTrainingSchema>;

export const UpdateTrainingSchema = Type.Object({
  beekeeperId: Type.Optional(Type.String({ minLength: 1, maxLength: 255 })),
  trainingType: Type.Optional(Type.String({ minLength: 1, maxLength: 255 })),
  completedDate: Type.Optional(Type.String({ format: 'date-time' })),
  certificationNumber: Type.Optional(Type.String({ minLength: 1, maxLength: 255 })),
  dataClassification: Type.Optional(
    Type.Union([
      Type.Literal('PUBLIC'),
      Type.Literal('PARTNER'),
      Type.Literal('RESTRICTED'),
      Type.Literal('CONFIDENTIAL'),
    ]),
  ),
});
export type UpdateTrainingInput = Static<typeof UpdateTrainingSchema>;

export const TrainingFilterSchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  beekeeperId: Type.Optional(Type.String({ minLength: 1 })),
  trainingType: Type.Optional(Type.String({ minLength: 1 })),
});
export type TrainingFilterInput = Static<typeof TrainingFilterSchema>;

export const UuidParamSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
});
export type UuidParamInput = Static<typeof UuidParamSchema>;

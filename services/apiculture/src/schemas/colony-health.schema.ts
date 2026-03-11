import { Type, type Static } from '@sinclair/typebox';

export const CreateColonyHealthSchema = Type.Object({
  apiaryId: Type.String({ format: 'uuid' }),
  inspectionDate: Type.String({ format: 'date-time' }),
  colonyStrength: Type.Union([
    Type.Literal('STRONG'),
    Type.Literal('MEDIUM'),
    Type.Literal('WEAK'),
    Type.Literal('DEAD'),
  ]),
  diseases: Type.Array(
    Type.Union([
      Type.Literal('VARROA'),
      Type.Literal('AFB'),
      Type.Literal('EFB'),
      Type.Literal('NOSEMA'),
      Type.Literal('NONE'),
    ]),
  ),
  treatments: Type.Array(Type.String({ minLength: 1 })),
  dataClassification: Type.Optional(
    Type.Union([
      Type.Literal('PUBLIC'),
      Type.Literal('PARTNER'),
      Type.Literal('RESTRICTED'),
      Type.Literal('CONFIDENTIAL'),
    ]),
  ),
});
export type CreateColonyHealthInput = Static<typeof CreateColonyHealthSchema>;

export const UpdateColonyHealthSchema = Type.Object({
  apiaryId: Type.Optional(Type.String({ format: 'uuid' })),
  inspectionDate: Type.Optional(Type.String({ format: 'date-time' })),
  colonyStrength: Type.Optional(
    Type.Union([
      Type.Literal('STRONG'),
      Type.Literal('MEDIUM'),
      Type.Literal('WEAK'),
      Type.Literal('DEAD'),
    ]),
  ),
  diseases: Type.Optional(
    Type.Array(
      Type.Union([
        Type.Literal('VARROA'),
        Type.Literal('AFB'),
        Type.Literal('EFB'),
        Type.Literal('NOSEMA'),
        Type.Literal('NONE'),
      ]),
    ),
  ),
  treatments: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
  dataClassification: Type.Optional(
    Type.Union([
      Type.Literal('PUBLIC'),
      Type.Literal('PARTNER'),
      Type.Literal('RESTRICTED'),
      Type.Literal('CONFIDENTIAL'),
    ]),
  ),
});
export type UpdateColonyHealthInput = Static<typeof UpdateColonyHealthSchema>;

export const ColonyHealthFilterSchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  apiaryId: Type.Optional(Type.String({ format: 'uuid' })),
  colonyStrength: Type.Optional(
    Type.Union([
      Type.Literal('STRONG'),
      Type.Literal('MEDIUM'),
      Type.Literal('WEAK'),
      Type.Literal('DEAD'),
    ]),
  ),
  disease: Type.Optional(
    Type.Union([
      Type.Literal('VARROA'),
      Type.Literal('AFB'),
      Type.Literal('EFB'),
      Type.Literal('NOSEMA'),
      Type.Literal('NONE'),
    ]),
  ),
});
export type ColonyHealthFilterInput = Static<typeof ColonyHealthFilterSchema>;

export const UuidParamSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
});
export type UuidParamInput = Static<typeof UuidParamSchema>;

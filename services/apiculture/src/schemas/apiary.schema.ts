import { Type, type Static } from '@sinclair/typebox';

export const CreateApiarySchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 255 }),
  geoEntityId: Type.String({ format: 'uuid' }),
  latitude: Type.Optional(Type.Number({ minimum: -90, maximum: 90 })),
  longitude: Type.Optional(Type.Number({ minimum: -180, maximum: 180 })),
  hiveCount: Type.Integer({ minimum: 0 }),
  hiveType: Type.Union([
    Type.Literal('LANGSTROTH'),
    Type.Literal('TOP_BAR'),
    Type.Literal('KENYAN_TOP_BAR'),
    Type.Literal('TRADITIONAL'),
  ]),
  ownerName: Type.String({ minLength: 1, maxLength: 255 }),
  dataClassification: Type.Optional(
    Type.Union([
      Type.Literal('PUBLIC'),
      Type.Literal('PARTNER'),
      Type.Literal('RESTRICTED'),
      Type.Literal('CONFIDENTIAL'),
    ]),
  ),
});
export type CreateApiaryInput = Static<typeof CreateApiarySchema>;

export const UpdateApiarySchema = Type.Object({
  name: Type.Optional(Type.String({ minLength: 1, maxLength: 255 })),
  geoEntityId: Type.Optional(Type.String({ format: 'uuid' })),
  latitude: Type.Optional(Type.Number({ minimum: -90, maximum: 90 })),
  longitude: Type.Optional(Type.Number({ minimum: -180, maximum: 180 })),
  hiveCount: Type.Optional(Type.Integer({ minimum: 0 })),
  hiveType: Type.Optional(
    Type.Union([
      Type.Literal('LANGSTROTH'),
      Type.Literal('TOP_BAR'),
      Type.Literal('KENYAN_TOP_BAR'),
      Type.Literal('TRADITIONAL'),
    ]),
  ),
  ownerName: Type.Optional(Type.String({ minLength: 1, maxLength: 255 })),
  dataClassification: Type.Optional(
    Type.Union([
      Type.Literal('PUBLIC'),
      Type.Literal('PARTNER'),
      Type.Literal('RESTRICTED'),
      Type.Literal('CONFIDENTIAL'),
    ]),
  ),
});
export type UpdateApiaryInput = Static<typeof UpdateApiarySchema>;

export const ApiaryFilterSchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  hiveType: Type.Optional(
    Type.Union([
      Type.Literal('LANGSTROTH'),
      Type.Literal('TOP_BAR'),
      Type.Literal('KENYAN_TOP_BAR'),
      Type.Literal('TRADITIONAL'),
    ]),
  ),
  geoEntityId: Type.Optional(Type.String({ format: 'uuid' })),
});
export type ApiaryFilterInput = Static<typeof ApiaryFilterSchema>;

export const UuidParamSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
});
export type UuidParamInput = Static<typeof UuidParamSchema>;

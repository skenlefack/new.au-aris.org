import { Type, Static } from '@sinclair/typebox';

export const CreateTemplateSchema = Type.Object({
  name: Type.String({ minLength: 2, maxLength: 255 }),
  domain: Type.String({ minLength: 2, maxLength: 50 }),
  parentTemplateId: Type.Optional(Type.String({ format: 'uuid' })),
  schema: Type.Record(Type.String(), Type.Unknown()),
  uiSchema: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  dataContractId: Type.Optional(Type.String({ format: 'uuid' })),
  dataClassification: Type.Optional(
    Type.Union([
      Type.Literal('PUBLIC'),
      Type.Literal('PARTNER'),
      Type.Literal('RESTRICTED'),
      Type.Literal('CONFIDENTIAL'),
    ]),
  ),
});
export type CreateTemplateBody = Static<typeof CreateTemplateSchema>;

export const UpdateTemplateSchema = Type.Object({
  name: Type.Optional(Type.String({ minLength: 2, maxLength: 255 })),
  domain: Type.Optional(Type.String({ minLength: 2, maxLength: 50 })),
  schema: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  uiSchema: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  dataContractId: Type.Optional(Type.String({ format: 'uuid' })),
  dataClassification: Type.Optional(
    Type.Union([
      Type.Literal('PUBLIC'),
      Type.Literal('PARTNER'),
      Type.Literal('RESTRICTED'),
      Type.Literal('CONFIDENTIAL'),
    ]),
  ),
});
export type UpdateTemplateBody = Static<typeof UpdateTemplateSchema>;

export const ListTemplatesQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  sort: Type.Optional(Type.String()),
  order: Type.Optional(Type.Union([Type.Literal('asc'), Type.Literal('desc')])),
  domain: Type.Optional(Type.String()),
  status: Type.Optional(Type.String()),
});
export type ListTemplatesQuery = Static<typeof ListTemplatesQuerySchema>;

export const IdParamSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
});
export type IdParam = Static<typeof IdParamSchema>;

import { Type, Static } from '@sinclair/typebox';

export const TargetSchema = Type.Object({
  domainCode: Type.String({ minLength: 2, maxLength: 50 }),
  subDomainCode: Type.Optional(Type.Union([Type.String({ maxLength: 50 }), Type.Null()])),
  isPrimary: Type.Optional(Type.Boolean()),
});
export type TargetInput = Static<typeof TargetSchema>;

export const CreateTemplateSchema = Type.Object({
  name: Type.String({ minLength: 2, maxLength: 255 }),
  domain: Type.Optional(Type.String({ minLength: 2, maxLength: 50 })),
  formType: Type.Optional(Type.Union([Type.Literal('CAMPAIGN'), Type.Literal('EVENT_ALERT')])),
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
  targets: Type.Optional(Type.Array(TargetSchema, { minItems: 1 })),
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
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 500 })),
  sort: Type.Optional(Type.String()),
  order: Type.Optional(Type.Union([Type.Literal('asc'), Type.Literal('desc')])),
  search: Type.Optional(Type.String()),
  domain: Type.Optional(Type.String()),
  domainCode: Type.Optional(Type.String()),
  subDomainCode: Type.Optional(Type.String()),
  formType: Type.Optional(Type.String()),
  status: Type.Optional(Type.String()),
});
export type ListTemplatesQuery = Static<typeof ListTemplatesQuerySchema>;

export const IdParamSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
});
export type IdParam = Static<typeof IdParamSchema>;

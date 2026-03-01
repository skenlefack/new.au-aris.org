import { Type, type Static } from '@sinclair/typebox';

export const ExternalSystemEnum = Type.Union([
  Type.Literal('WAHIS'),
  Type.Literal('DHIS2'),
  Type.Literal('FHIR'),
  Type.Literal('OMS'),
  Type.Literal('EMPRES'),
  Type.Literal('FAOSTAT'),
]);

export const AuthTypeEnum = Type.Union([
  Type.Literal('BASIC'),
  Type.Literal('OAUTH2'),
  Type.Literal('API_KEY'),
  Type.Literal('CERTIFICATE'),
]);

export const CreateConnectionSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 255 }),
  system: ExternalSystemEnum,
  baseUrl: Type.String({ minLength: 1 }),
  authType: AuthTypeEnum,
  credentials: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  syncFrequency: Type.Optional(Type.String()),
  config: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});
export type CreateConnectionBody = Static<typeof CreateConnectionSchema>;

export const UpdateConnectionSchema = Type.Object({
  name: Type.Optional(Type.String({ minLength: 1, maxLength: 255 })),
  baseUrl: Type.Optional(Type.String({ minLength: 1 })),
  authType: Type.Optional(AuthTypeEnum),
  credentials: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  isActive: Type.Optional(Type.Boolean()),
  syncFrequency: Type.Optional(Type.String()),
  config: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});
export type UpdateConnectionBody = Static<typeof UpdateConnectionSchema>;

export const IdParamSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
});
export type IdParam = Static<typeof IdParamSchema>;

export const ConnectionListQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  system: Type.Optional(ExternalSystemEnum),
  isActive: Type.Optional(Type.Boolean()),
});
export type ConnectionListQuery = Static<typeof ConnectionListQuerySchema>;

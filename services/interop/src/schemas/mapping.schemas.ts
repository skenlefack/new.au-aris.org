import { Type, type Static } from '@sinclair/typebox';

export const MappingDirectionEnum = Type.Union([
  Type.Literal('INBOUND'),
  Type.Literal('OUTBOUND'),
  Type.Literal('BIDIRECTIONAL'),
]);

export const CreateMappingSchema = Type.Object({
  sourceField: Type.String({ minLength: 1 }),
  targetField: Type.String({ minLength: 1 }),
  transformation: Type.Optional(Type.String()),
  direction: MappingDirectionEnum,
  entityType: Type.String({ minLength: 1, maxLength: 100 }),
});
export type CreateMappingBody = Static<typeof CreateMappingSchema>;

export const UpdateMappingSchema = Type.Object({
  sourceField: Type.Optional(Type.String({ minLength: 1 })),
  targetField: Type.Optional(Type.String({ minLength: 1 })),
  transformation: Type.Optional(Type.String()),
  direction: Type.Optional(MappingDirectionEnum),
  entityType: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
  isActive: Type.Optional(Type.Boolean()),
});
export type UpdateMappingBody = Static<typeof UpdateMappingSchema>;

export const ConnectionIdParamSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
});
export type ConnectionIdParam = Static<typeof ConnectionIdParamSchema>;

export const MappingIdParamSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  mid: Type.String({ format: 'uuid' }),
});
export type MappingIdParam = Static<typeof MappingIdParamSchema>;

export const MappingListQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
});
export type MappingListQuery = Static<typeof MappingListQuerySchema>;

import { Type, type Static } from '@sinclair/typebox';

const JsonValue = Type.Union([
  Type.String(),
  Type.Record(Type.String(), Type.String()),
]);

// ---------- Role ----------

export const RoleBodySchema = Type.Object({
  code: Type.String({ minLength: 1, maxLength: 50 }),
  name: JsonValue,
  description: Type.Optional(JsonValue),
  level: Type.Union([
    Type.Literal('continental'),
    Type.Literal('regional'),
    Type.Literal('national'),
  ]),
  color: Type.Optional(Type.String({ maxLength: 20 })),
  icon: Type.Optional(Type.String({ maxLength: 50 })),
  isActive: Type.Optional(Type.Boolean()),
  sortOrder: Type.Optional(Type.Integer({ minimum: 0 })),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});
export type RoleBodyInput = Static<typeof RoleBodySchema>;

export const RoleUpdateBodySchema = Type.Object({
  name: Type.Optional(JsonValue),
  description: Type.Optional(JsonValue),
  level: Type.Optional(Type.Union([
    Type.Literal('continental'),
    Type.Literal('regional'),
    Type.Literal('national'),
  ])),
  color: Type.Optional(Type.String({ maxLength: 20 })),
  icon: Type.Optional(Type.String({ maxLength: 50 })),
  isActive: Type.Optional(Type.Boolean()),
  sortOrder: Type.Optional(Type.Integer({ minimum: 0 })),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});
export type RoleUpdateBodyInput = Static<typeof RoleUpdateBodySchema>;

export const RoleQuerySchema = Type.Object({
  search: Type.Optional(Type.String()),
  level: Type.Optional(Type.String()),
  status: Type.Optional(Type.String()),
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
});
export type RoleQueryInput = Static<typeof RoleQuerySchema>;

// ---------- Permissions ----------

export const PermissionQuerySchema = Type.Object({
  module: Type.Optional(Type.String()),
  feature: Type.Optional(Type.String()),
});
export type PermissionQueryInput = Static<typeof PermissionQuerySchema>;

export const RolePermissionBatchSchema = Type.Object({
  permissionIds: Type.Array(Type.String({ format: 'uuid' })),
});
export type RolePermissionBatchInput = Static<typeof RolePermissionBatchSchema>;

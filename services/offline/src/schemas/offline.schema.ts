import { Type, Static } from '@sinclair/typebox';

// ── Params ──

export const SessionIdParamSchema = Type.Object({
  sessionId: Type.String({ format: 'uuid' }),
});
export type SessionIdParam = Static<typeof SessionIdParamSchema>;

export const DeviceIdParamSchema = Type.Object({
  deviceId: Type.String({ minLength: 1, maxLength: 255 }),
});
export type DeviceIdParam = Static<typeof DeviceIdParamSchema>;

export const ConflictIdParamSchema = Type.Object({
  conflictId: Type.String({ format: 'uuid' }),
});
export type ConflictIdParam = Static<typeof ConflictIdParamSchema>;

// ── Init Session ──

export const InitSessionSchema = Type.Object({
  deviceId: Type.String({ minLength: 1, maxLength: 255 }),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});
export type InitSessionBody = Static<typeof InitSessionSchema>;

// ── Push Deltas ──

export const DeltaItemSchema = Type.Object({
  id: Type.String({ format: 'uuid', description: 'Client-generated delta ID for idempotence' }),
  entityType: Type.String({ minLength: 1, maxLength: 100 }),
  entityId: Type.String({ minLength: 1, maxLength: 255 }),
  operation: Type.Union([
    Type.Literal('CREATE'),
    Type.Literal('UPDATE'),
    Type.Literal('DELETE'),
  ]),
  payload: Type.Record(Type.String(), Type.Unknown()),
  version: Type.Integer({ minimum: 0 }),
  clientTimestamp: Type.String({ format: 'date-time' }),
});
export type DeltaItem = Static<typeof DeltaItemSchema>;

export const PushDeltasSchema = Type.Object({
  deltas: Type.Array(DeltaItemSchema, { minItems: 1, maxItems: 500 }),
});
export type PushDeltasBody = Static<typeof PushDeltasSchema>;

// ── Pull Deltas ──

export const PullDeltasSchema = Type.Object({
  since: Type.Optional(Type.String({ format: 'date-time' })),
  entityTypes: Type.Optional(Type.Array(Type.String(), { maxItems: 50 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 1000, default: 500 })),
});
export type PullDeltasBody = Static<typeof PullDeltasSchema>;

// ── Complete Session ──

export const CompleteSessionSchema = Type.Object({
  status: Type.Optional(Type.Union([
    Type.Literal('COMPLETED'),
    Type.Literal('FAILED'),
    Type.Literal('PARTIAL'),
  ])),
  errorMessage: Type.Optional(Type.String()),
});
export type CompleteSessionBody = Static<typeof CompleteSessionSchema>;

// ── Device Registration ──

export const RegisterDeviceSchema = Type.Object({
  deviceId: Type.String({ minLength: 1, maxLength: 255 }),
  platform: Type.String({ minLength: 1, maxLength: 50 }),
  appVersion: Type.String({ minLength: 1, maxLength: 20 }),
});
export type RegisterDeviceBody = Static<typeof RegisterDeviceSchema>;

// ── Resolve Conflict ──

export const ResolveConflictSchema = Type.Object({
  resolution: Type.Union([
    Type.Literal('CLIENT_WINS'),
    Type.Literal('SERVER_WINS'),
    Type.Literal('MERGE'),
  ]),
  mergedPayload: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});
export type ResolveConflictBody = Static<typeof ResolveConflictSchema>;

// ── List Conflicts Query ──

export const ListConflictsQuerySchema = Type.Object({
  sessionId: Type.Optional(Type.String({ format: 'uuid' })),
  entityType: Type.Optional(Type.String()),
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
});
export type ListConflictsQuery = Static<typeof ListConflictsQuerySchema>;

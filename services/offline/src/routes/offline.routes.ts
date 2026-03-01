import type { FastifyInstance } from 'fastify';
import { rolesHook, tenantHook } from '@aris/auth-middleware';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  InitSessionSchema,
  PushDeltasSchema,
  PullDeltasSchema,
  CompleteSessionSchema,
  SessionIdParamSchema,
  RegisterDeviceSchema,
  DeviceIdParamSchema,
  ResolveConflictSchema,
  ConflictIdParamSchema,
  ListConflictsQuerySchema,
} from '../schemas/offline.schema';
import type {
  InitSessionBody,
  PushDeltasBody,
  PullDeltasBody,
  CompleteSessionBody,
  SessionIdParam,
  RegisterDeviceBody,
  DeviceIdParam,
  ResolveConflictBody,
  ConflictIdParam,
  ListConflictsQuery,
} from '../schemas/offline.schema';

/** Roles allowed to resolve conflicts manually */
const RESOLVE_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.CONTINENTAL_ADMIN,
  UserRole.REC_ADMIN,
  UserRole.NATIONAL_ADMIN,
  UserRole.DATA_STEWARD,
];

export async function registerOfflineRoutes(app: FastifyInstance): Promise<void> {
  const auth = app.authHookFn;
  const tenant = tenantHook();

  // ────────────────────────────────────────────
  // 1. POST /api/v1/offline/sessions/init
  // ────────────────────────────────────────────
  app.post<{ Body: InitSessionBody }>('/api/v1/offline/sessions/init', {
    schema: { body: InitSessionSchema },
    preHandler: [auth, tenant],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.offlineService.initSession(
      request.body,
      user.userId,
      user.tenantId,
    );
    return reply.code(201).send({ data: result });
  });

  // ────────────────────────────────────────────
  // 2. POST /api/v1/offline/sessions/:sessionId/push
  // ────────────────────────────────────────────
  app.post<{ Params: SessionIdParam; Body: PushDeltasBody }>('/api/v1/offline/sessions/:sessionId/push', {
    schema: { params: SessionIdParamSchema, body: PushDeltasSchema },
    preHandler: [auth, tenant],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.offlineService.pushDeltas(
      request.params.sessionId,
      request.body.deltas,
      user.userId,
      user.tenantId,
    );
    return reply.code(200).send({ data: result });
  });

  // ────────────────────────────────────────────
  // 3. POST /api/v1/offline/sessions/:sessionId/pull
  // ────────────────────────────────────────────
  app.post<{ Params: SessionIdParam; Body: PullDeltasBody }>('/api/v1/offline/sessions/:sessionId/pull', {
    schema: { params: SessionIdParamSchema, body: PullDeltasSchema },
    preHandler: [auth, tenant],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.offlineService.pullDeltas(
      request.params.sessionId,
      request.body,
      user.userId,
      user.tenantId,
    );
    return reply.code(200).send(result);
  });

  // ────────────────────────────────────────────
  // 4. POST /api/v1/offline/sessions/:sessionId/complete
  // ────────────────────────────────────────────
  app.post<{ Params: SessionIdParam; Body: CompleteSessionBody }>('/api/v1/offline/sessions/:sessionId/complete', {
    schema: { params: SessionIdParamSchema, body: CompleteSessionSchema },
    preHandler: [auth, tenant],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.offlineService.completeSession(
      request.params.sessionId,
      request.body,
      user.userId,
      user.tenantId,
    );
    return reply.code(200).send({ data: result });
  });

  // ────────────────────────────────────────────
  // 5. GET /api/v1/offline/sessions/:sessionId
  // ────────────────────────────────────────────
  app.get<{ Params: SessionIdParam }>('/api/v1/offline/sessions/:sessionId', {
    schema: { params: SessionIdParamSchema },
    preHandler: [auth, tenant],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.offlineService.getSession(
      request.params.sessionId,
      user.tenantId,
    );
    return { data: result };
  });

  // ────────────────────────────────────────────
  // 6. POST /api/v1/offline/devices/register
  // ────────────────────────────────────────────
  app.post<{ Body: RegisterDeviceBody }>('/api/v1/offline/devices/register', {
    schema: { body: RegisterDeviceSchema },
    preHandler: [auth, tenant],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.offlineService.devices.register(
      request.body,
      user.userId,
      user.tenantId,
    );
    return reply.code(201).send({ data: result });
  });

  // ────────────────────────────────────────────
  // 7. GET /api/v1/offline/devices/:deviceId
  // ────────────────────────────────────────────
  app.get<{ Params: DeviceIdParam }>('/api/v1/offline/devices/:deviceId', {
    schema: { params: DeviceIdParamSchema },
    preHandler: [auth, tenant],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.offlineService.devices.getDevice(
      request.params.deviceId,
      user.tenantId,
    );
    return { data: result };
  });

  // ────────────────────────────────────────────
  // 8. POST /api/v1/offline/conflicts/:conflictId/resolve
  // ────────────────────────────────────────────
  app.post<{ Params: ConflictIdParam; Body: ResolveConflictBody }>('/api/v1/offline/conflicts/:conflictId/resolve', {
    schema: { params: ConflictIdParamSchema, body: ResolveConflictSchema },
    preHandler: [auth, tenant, rolesHook(...RESOLVE_ROLES)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.offlineService.resolveConflict(
      request.params.conflictId,
      request.body.resolution,
      user.tenantId,
      user.userId,
      request.body.mergedPayload,
    );
    return { data: { resolved: true, ...result } };
  });

  // ────────────────────────────────────────────
  // 9. GET /api/v1/offline/conflicts
  // ────────────────────────────────────────────
  app.get<{ Querystring: ListConflictsQuery }>('/api/v1/offline/conflicts', {
    schema: { querystring: ListConflictsQuerySchema },
    preHandler: [auth, tenant, rolesHook(...RESOLVE_ROLES)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.offlineService.listConflicts(user.tenantId, request.query);
  });
}

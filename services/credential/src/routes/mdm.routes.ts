import type { FastifyInstance } from 'fastify';
import { rolesHook, tenantHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  EnrollDeviceSchema,
  HeartbeatSchema,
  AcknowledgeCommandSchema,
  SendCommandSchema,
  CreateReleaseSchema,
  UpdateReleaseSchema,
  ListDevicesQuerySchema,
  VersionCheckQuerySchema,
  UuidParamSchema,
  type EnrollDeviceInput,
  type HeartbeatInput,
  type AcknowledgeCommandInput,
  type SendCommandInput,
  type CreateReleaseInput,
  type UpdateReleaseInput,
  type ListDevicesQueryInput,
  type VersionCheckQueryInput,
  type UuidParamInput,
} from '../schemas/mdm.schemas.js';

export async function registerMdmRoutes(app: FastifyInstance): Promise<void> {
  const authAndTenant = [app.authHookFn, tenantHook()];
  const adminOnly = [
    ...authAndTenant,
    rolesHook(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN),
  ];

  // ═══════════════════════════════════════════════════════════════════
  // Mobile client routes (any authenticated user)
  // ═══════════════════════════════════════════════════════════════════

  // POST /api/v1/credential/mdm/enroll
  app.post<{ Body: EnrollDeviceInput }>('/api/v1/credential/mdm/enroll', {
    schema: { body: EnrollDeviceSchema },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.mdmService.enroll(request.body, user);
  });

  // POST /api/v1/credential/mdm/heartbeat
  app.post<{ Body: HeartbeatInput }>('/api/v1/credential/mdm/heartbeat', {
    schema: { body: HeartbeatSchema },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.mdmService.heartbeat(request.body, user);
  });

  // POST /api/v1/credential/mdm/commands/:id/ack
  app.post<{ Params: UuidParamInput; Body: AcknowledgeCommandInput }>('/api/v1/credential/mdm/commands/:id/ack', {
    schema: { params: UuidParamSchema, body: AcknowledgeCommandSchema },
    preHandler: authAndTenant,
  }, async (request) => {
    return app.mdmService.acknowledgeCommand(request.params.id, request.body);
  });

  // GET /api/v1/credential/mdm/version-check
  app.get<{ Querystring: VersionCheckQueryInput }>('/api/v1/credential/mdm/version-check', {
    schema: { querystring: VersionCheckQuerySchema },
    preHandler: authAndTenant,
  }, async (request) => {
    const { currentVersionCode, deviceId } = request.query;
    const release = await app.mdmService.checkVersion(currentVersionCode, deviceId);
    return { data: release };
  });

  // ═══════════════════════════════════════════════════════════════════
  // Admin routes (SUPER_ADMIN, CONTINENTAL_ADMIN only)
  // ═══════════════════════════════════════════════════════════════════

  // GET /api/v1/credential/mdm/devices
  app.get<{ Querystring: ListDevicesQueryInput }>('/api/v1/credential/mdm/devices', {
    schema: { querystring: ListDevicesQuerySchema },
    preHandler: adminOnly,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.mdmService.listDevices(user, request.query);
  });

  // GET /api/v1/credential/mdm/devices/:id
  app.get<{ Params: UuidParamInput }>('/api/v1/credential/mdm/devices/:id', {
    schema: { params: UuidParamSchema },
    preHandler: adminOnly,
  }, async (request) => {
    return app.mdmService.getDevice(request.params.id);
  });

  // POST /api/v1/credential/mdm/devices/:id/commands
  app.post<{ Params: UuidParamInput; Body: SendCommandInput }>('/api/v1/credential/mdm/devices/:id/commands', {
    schema: { params: UuidParamSchema, body: SendCommandSchema },
    preHandler: adminOnly,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.mdmService.sendCommand(request.params.id, request.body, user);
  });

  // GET /api/v1/credential/mdm/releases
  app.get('/api/v1/credential/mdm/releases', {
    preHandler: adminOnly,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.mdmService.listReleases(user);
  });

  // POST /api/v1/credential/mdm/releases
  app.post<{ Body: CreateReleaseInput }>('/api/v1/credential/mdm/releases', {
    schema: { body: CreateReleaseSchema },
    preHandler: adminOnly,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.mdmService.createRelease(request.body, user);
  });

  // PATCH /api/v1/credential/mdm/releases/:id
  app.patch<{ Params: UuidParamInput; Body: UpdateReleaseInput }>('/api/v1/credential/mdm/releases/:id', {
    schema: { params: UuidParamSchema, body: UpdateReleaseSchema },
    preHandler: adminOnly,
  }, async (request) => {
    return app.mdmService.updateRelease(request.params.id, request.body);
  });

  // DELETE /api/v1/credential/mdm/releases/:id
  app.delete<{ Params: UuidParamInput }>('/api/v1/credential/mdm/releases/:id', {
    schema: { params: UuidParamSchema },
    preHandler: adminOnly,
  }, async (request) => {
    return app.mdmService.deleteRelease(request.params.id);
  });
}

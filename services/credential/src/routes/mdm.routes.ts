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
  ListAlertsQuerySchema,
  type ListAlertsQueryInput,
  LocationHistoryQuerySchema,
  type LocationHistoryQueryInput,
  CreatePolicySchema,
  type CreatePolicyInput,
  UpdatePolicySchema,
  type UpdatePolicyInput,
  EnrollmentSettingsSchema,
  type EnrollmentSettingsInput,
  UpdateProgressSchema,
  type UpdateProgressInput,
  ChartsQuerySchema,
  type ChartsQueryInput,
} from '../schemas/mdm.schemas.js';

export async function registerMdmRoutes(app: FastifyInstance): Promise<void> {
  const authAndTenant = [app.authHookFn, tenantHook()];
  const adminOnly = [
    ...authAndTenant,
    rolesHook(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN, UserRole.NATIONAL_ADMIN, UserRole.REC_ADMIN),
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
    const user = request.user as AuthenticatedUser;
    return app.mdmService.acknowledgeCommand(request.params.id, request.body, user);
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

  // GET /api/v1/credential/mdm/alerts
  app.get<{ Querystring: ListAlertsQueryInput }>('/api/v1/credential/mdm/alerts', {
    schema: { querystring: ListAlertsQuerySchema },
    preHandler: adminOnly,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.mdmService.listAlerts(user, request.query);
  });

  // PATCH /api/v1/credential/mdm/alerts/:id/resolve
  app.patch<{ Params: UuidParamInput }>('/api/v1/credential/mdm/alerts/:id/resolve', {
    schema: { params: UuidParamSchema },
    preHandler: adminOnly,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.mdmService.resolveAlert(request.params.id, user);
  });

  // ═══════════════════════════════════════════════════════════════════
  // Location History & Security Policies (Phase 2)
  // ═══════════════════════════════════════════════════════════════════

  // GET /api/v1/credential/mdm/devices/:id/locations
  app.get<{ Params: UuidParamInput; Querystring: LocationHistoryQueryInput }>('/api/v1/credential/mdm/devices/:id/locations', {
    schema: { params: UuidParamSchema, querystring: LocationHistoryQuerySchema },
    preHandler: adminOnly,
  }, async (request) => {
    return app.mdmService.getLocationHistory(request.params.id, request.query);
  });

  // GET /api/v1/credential/mdm/policies
  app.get('/api/v1/credential/mdm/policies', {
    preHandler: adminOnly,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.mdmService.listPolicies(user);
  });

  // POST /api/v1/credential/mdm/policies
  app.post<{ Body: CreatePolicyInput }>('/api/v1/credential/mdm/policies', {
    schema: { body: CreatePolicySchema },
    preHandler: adminOnly,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.mdmService.createPolicy(request.body, user);
  });

  // PATCH /api/v1/credential/mdm/policies/:id
  app.patch<{ Params: UuidParamInput; Body: UpdatePolicyInput }>('/api/v1/credential/mdm/policies/:id', {
    schema: { params: UuidParamSchema, body: UpdatePolicySchema },
    preHandler: adminOnly,
  }, async (request) => {
    return app.mdmService.updatePolicy(request.params.id, request.body);
  });

  // DELETE /api/v1/credential/mdm/policies/:id
  app.delete<{ Params: UuidParamInput }>('/api/v1/credential/mdm/policies/:id', {
    schema: { params: UuidParamSchema },
    preHandler: adminOnly,
  }, async (request) => {
    return app.mdmService.deletePolicy(request.params.id);
  });

  // ═══════════════════════════════════════════════════════════════════
  // Enrollment workflow
  // ═══════════════════════════════════════════════════════════════════

  // PATCH /api/v1/credential/mdm/devices/:id/approve
  app.patch<{ Params: UuidParamInput }>('/api/v1/credential/mdm/devices/:id/approve', {
    schema: { params: UuidParamSchema },
    preHandler: adminOnly,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.mdmService.approveDevice(request.params.id, user);
  });

  // PATCH /api/v1/credential/mdm/devices/:id/reject
  app.patch<{ Params: UuidParamInput }>('/api/v1/credential/mdm/devices/:id/reject', {
    schema: { params: UuidParamSchema },
    preHandler: adminOnly,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.mdmService.rejectDevice(request.params.id, user);
  });

  // PATCH /api/v1/credential/mdm/devices/:id/revoke
  app.patch<{ Params: UuidParamInput }>('/api/v1/credential/mdm/devices/:id/revoke', {
    schema: { params: UuidParamSchema },
    preHandler: adminOnly,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.mdmService.revokeDevice(request.params.id, user);
  });

  // GET /api/v1/credential/mdm/settings
  app.get('/api/v1/credential/mdm/settings', {
    preHandler: adminOnly,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.mdmService.getEnrollmentSettings(user);
  });

  // PATCH /api/v1/credential/mdm/settings
  app.patch<{ Body: EnrollmentSettingsInput }>('/api/v1/credential/mdm/settings', {
    schema: { body: EnrollmentSettingsSchema },
    preHandler: adminOnly,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.mdmService.updateEnrollmentSettings(request.body, user);
  });

  // ═══════════════════════════════════════════════════════════════════
  // Compliance & OTA Update Tracking (Phase 3)
  // ═══════════════════════════════════════════════════════════════════

  // GET /api/v1/credential/mdm/devices/:id/compliance
  app.get<{ Params: UuidParamInput }>('/api/v1/credential/mdm/devices/:id/compliance', {
    schema: { params: UuidParamSchema },
    preHandler: adminOnly,
  }, async (request) => {
    return app.mdmService.getDeviceCompliance(request.params.id);
  });

  // POST /api/v1/credential/mdm/update-progress (mobile)
  app.post<{ Body: UpdateProgressInput }>('/api/v1/credential/mdm/update-progress', {
    schema: { body: UpdateProgressSchema },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.mdmService.reportUpdateProgress(request.body, user);
  });

  // GET /api/v1/credential/mdm/releases/:id/rollout
  app.get<{ Params: UuidParamInput }>('/api/v1/credential/mdm/releases/:id/rollout', {
    schema: { params: UuidParamSchema },
    preHandler: adminOnly,
  }, async (request) => {
    return app.mdmService.getRolloutStatus(request.params.id);
  });

  // ═══════════════════════════════════════════════════════════════════
  // Dashboard (Phase 6)
  // ═══════════════════════════════════════════════════════════════════

  // GET /api/v1/credential/mdm/stats
  app.get('/api/v1/credential/mdm/stats', {
    preHandler: adminOnly,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.mdmService.getStats(user);
  });

  // GET /api/v1/credential/mdm/charts
  app.get<{ Querystring: ChartsQueryInput }>('/api/v1/credential/mdm/charts', {
    schema: { querystring: ChartsQuerySchema },
    preHandler: adminOnly,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    const { metric, from, to } = request.query;
    return app.mdmService.getChartData(user, metric, from, to);
  });
}

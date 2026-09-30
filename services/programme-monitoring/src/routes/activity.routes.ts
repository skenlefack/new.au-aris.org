import type { FastifyInstance } from 'fastify';
import { rolesHook, tenantHook, domainsHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  CreateActivitySchema, UpdateActivitySchema, ActivityFilterSchema,
  CreateSubActivitySchema, UpdateSubActivitySchema,
  type CreateActivityInput, type UpdateActivityInput, type ActivityFilterInput,
  type CreateSubActivityInput, type UpdateSubActivityInput,
} from '../schemas/activity.schema.js';
import { PaginationQuerySchema, UuidParamSchema, type PaginationQueryInput, type UuidParamInput } from '../schemas/common.schema.js';

const PREFIX = '/api/v1/programme-monitoring/activities';

const WRITE_ROLES = [
  UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN, UserRole.REC_ADMIN,
  UserRole.NATIONAL_ADMIN, UserRole.DATA_STEWARD,
];

export async function registerActivityRoutes(app: FastifyInstance): Promise<void> {
  const authAndTenant = [app.authHookFn, tenantHook(), domainsHook('programme-monitoring')];

  // POST — create activity
  app.post<{ Body: CreateActivityInput }>(PREFIX, {
    schema: { body: CreateActivitySchema },
    preHandler: [...authAndTenant, rolesHook(...WRITE_ROLES)],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    return reply.code(201).send(await app.activityService.create(request.body, user));
  });

  // GET — list activities (filterable by output, status, responsible, programme)
  app.get<{ Querystring: PaginationQueryInput & ActivityFilterInput }>(PREFIX, {
    schema: {
      querystring: {
        ...PaginationQuerySchema,
        ...ActivityFilterSchema,
        type: 'object' as const,
        properties: { ...PaginationQuerySchema.properties, ...ActivityFilterSchema.properties },
      },
    },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    const { page, limit, sort, order, ...filter } = request.query;
    return app.activityService.findAll(user, { page, limit, sort, order }, filter);
  });

  // GET — get activity by ID
  app.get<{ Params: UuidParamInput }>(`${PREFIX}/:id`, {
    schema: { params: UuidParamSchema },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.activityService.findOne(request.params.id, user);
  });

  // PATCH — update activity
  app.patch<{ Params: UuidParamInput; Body: UpdateActivityInput }>(`${PREFIX}/:id`, {
    schema: { params: UuidParamSchema, body: UpdateActivitySchema },
    preHandler: [...authAndTenant, rolesHook(...WRITE_ROLES)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.activityService.update(request.params.id, request.body, user);
  });

  // ── Sub-Activities ──

  app.post<{ Params: UuidParamInput; Body: CreateSubActivityInput }>(`${PREFIX}/:id/sub-activities`, {
    schema: { params: UuidParamSchema, body: CreateSubActivitySchema },
    preHandler: [...authAndTenant, rolesHook(...WRITE_ROLES)],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    return reply.code(201).send(await app.activityService.createSubActivity(request.params.id, request.body, user));
  });

  app.get<{ Params: UuidParamInput }>(`${PREFIX}/:id/sub-activities`, {
    schema: { params: UuidParamSchema },
    preHandler: authAndTenant,
  }, async (request) => {
    return app.activityService.findSubActivities(request.params.id);
  });

  // PATCH sub-activity
  app.patch<{ Params: UuidParamInput; Body: UpdateSubActivityInput }>(`/api/v1/programme-monitoring/sub-activities/:id`, {
    schema: { params: UuidParamSchema, body: UpdateSubActivitySchema },
    preHandler: [...authAndTenant, rolesHook(...WRITE_ROLES)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.activityService.updateSubActivity(request.params.id, request.body, user);
  });

  // ── Milestones ──

  app.post<{ Params: UuidParamInput }>(`${PREFIX}/:id/milestones`, {
    preHandler: [...authAndTenant, rolesHook(...WRITE_ROLES)],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    return reply.code(201).send(await app.activityService.createMilestone(request.params.id, request.body, user));
  });

  app.patch<{ Params: UuidParamInput }>(`/api/v1/programme-monitoring/milestones/:id`, {
    schema: { params: UuidParamSchema },
    preHandler: [...authAndTenant, rolesHook(...WRITE_ROLES)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.activityService.updateMilestone(request.params.id, request.body, user);
  });
}

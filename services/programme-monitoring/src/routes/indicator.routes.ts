import type { FastifyInstance } from 'fastify';
import { rolesHook, tenantHook, domainsHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  CreateIndicatorSchema, UpdateIndicatorSchema, CreateIndicatorValueSchema, ValidateIndicatorValueSchema,
  type CreateIndicatorInput, type UpdateIndicatorInput,
  type CreateIndicatorValueInput, type ValidateIndicatorValueInput,
} from '../schemas/indicator.schema.js';
import { PaginationQuerySchema, UuidParamSchema, type PaginationQueryInput, type UuidParamInput } from '../schemas/common.schema.js';

const PREFIX = '/api/v1/programme-monitoring/indicators';

const WRITE_ROLES = [
  UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN, UserRole.DATA_STEWARD,
];

export async function registerIndicatorRoutes(app: FastifyInstance): Promise<void> {
  const authAndTenant = [app.authHookFn, tenantHook(), domainsHook('programme-monitoring')];

  // POST — create indicator
  app.post<{ Body: CreateIndicatorInput }>(PREFIX, {
    schema: { body: CreateIndicatorSchema },
    preHandler: [...authAndTenant, rolesHook(...WRITE_ROLES)],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    return reply.code(201).send(await app.indicatorService.create(request.body, user));
  });

  // GET — list indicators
  app.get<{ Querystring: PaginationQueryInput & { outputId?: string; programmeId?: string } }>(PREFIX, {
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    const { page, limit, ...filter } = request.query;
    return app.indicatorService.findAll(user, { page, limit }, filter);
  });

  // GET — get indicator by ID
  app.get<{ Params: UuidParamInput }>(`${PREFIX}/:id`, {
    schema: { params: UuidParamSchema },
    preHandler: authAndTenant,
  }, async (request) => {
    return app.indicatorService.findOne(request.params.id);
  });

  // PATCH — update indicator
  app.patch<{ Params: UuidParamInput; Body: UpdateIndicatorInput }>(`${PREFIX}/:id`, {
    schema: { params: UuidParamSchema, body: UpdateIndicatorSchema },
    preHandler: [...authAndTenant, rolesHook(...WRITE_ROLES)],
  }, async (request) => {
    return app.indicatorService.update(request.params.id, request.body);
  });

  // GET — indicator progress (baseline → target → actual)
  app.get<{ Params: UuidParamInput }>(`${PREFIX}/:id/progress`, {
    schema: { params: UuidParamSchema },
    preHandler: authAndTenant,
  }, async (request) => {
    return app.indicatorService.progress(request.params.id);
  });

  // POST — add indicator value
  app.post<{ Params: UuidParamInput; Body: CreateIndicatorValueInput }>(`${PREFIX}/:id/values`, {
    schema: { params: UuidParamSchema, body: CreateIndicatorValueSchema },
    preHandler: [...authAndTenant, rolesHook(...WRITE_ROLES)],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    return reply.code(201).send(await app.indicatorService.addValue(request.params.id, request.body, user));
  });

  // GET — indicator values time series
  app.get<{ Params: UuidParamInput }>(`${PREFIX}/:id/values`, {
    schema: { params: UuidParamSchema },
    preHandler: authAndTenant,
  }, async (request) => {
    return app.indicatorService.getValues(request.params.id);
  });

  // POST — validate indicator value
  app.post<{ Params: UuidParamInput; Body: ValidateIndicatorValueInput }>(
    `/api/v1/programme-monitoring/indicator-values/:id/validate`,
    {
      schema: { params: UuidParamSchema, body: ValidateIndicatorValueSchema },
      preHandler: [...authAndTenant, rolesHook(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN)],
    },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      return app.indicatorService.validateValue(request.params.id, request.body, user);
    },
  );
}

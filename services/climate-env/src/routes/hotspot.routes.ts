import type { FastifyInstance } from 'fastify';
import { rolesHook, tenantHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  CreateHotspotSchema,
  UpdateHotspotSchema,
  HotspotFilterSchema,
  PaginationQuerySchema,
  UuidParamSchema,
  type CreateHotspotInput,
  type UpdateHotspotInput,
  type HotspotFilterInput,
  type PaginationQueryInput,
  type UuidParamInput,
} from '../schemas/hotspot.schema.js';

const PREFIX = '/api/v1/climate/hotspots';

const CREATE_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.CONTINENTAL_ADMIN,
  UserRole.NATIONAL_ADMIN,
  UserRole.DATA_STEWARD,
  UserRole.FIELD_AGENT,
];

const UPDATE_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.CONTINENTAL_ADMIN,
  UserRole.NATIONAL_ADMIN,
  UserRole.DATA_STEWARD,
];

export async function registerHotspotRoutes(app: FastifyInstance): Promise<void> {
  const authAndTenant = [app.authHookFn, tenantHook()];

  // POST /api/v1/climate/hotspots -- create environmental hotspot
  app.post<{ Body: CreateHotspotInput }>(PREFIX, {
    schema: { body: CreateHotspotSchema },
    preHandler: [...authAndTenant, rolesHook(...CREATE_ROLES)],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.hotspotService.create(request.body, user);
    return reply.code(201).send(result);
  });

  // GET /api/v1/climate/hotspots -- list environmental hotspots
  app.get<{ Querystring: PaginationQueryInput & HotspotFilterInput }>(PREFIX, {
    schema: {
      querystring: {
        ...PaginationQuerySchema,
        ...HotspotFilterSchema,
        type: 'object' as const,
        properties: {
          ...PaginationQuerySchema.properties,
          ...HotspotFilterSchema.properties,
        },
      },
    },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    const { page, limit, sort, order, ...filter } = request.query;
    return app.hotspotService.findAll(user, { page, limit, sort, order }, filter);
  });

  // GET /api/v1/climate/hotspots/:id -- get environmental hotspot by ID
  app.get<{ Params: UuidParamInput }>(`${PREFIX}/:id`, {
    schema: { params: UuidParamSchema },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.hotspotService.findOne(request.params.id, user);
  });

  // PATCH /api/v1/climate/hotspots/:id -- update environmental hotspot
  app.patch<{ Params: UuidParamInput; Body: UpdateHotspotInput }>(`${PREFIX}/:id`, {
    schema: { params: UuidParamSchema, body: UpdateHotspotSchema },
    preHandler: [...authAndTenant, rolesHook(...UPDATE_ROLES)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.hotspotService.update(request.params.id, request.body, user);
  });
}

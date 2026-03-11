import type { FastifyInstance } from 'fastify';
import { rolesHook, tenantHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  CreateSpsCertificateSchema,
  UpdateSpsCertificateSchema,
  SpsCertificateFilterSchema,
  UuidParamSchema,
  type CreateSpsCertificateInput,
  type UpdateSpsCertificateInput,
  type SpsCertificateFilterInput,
  type UuidParamInput,
} from '../schemas/sps-certificate.schema.js';

const ALLOWED_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.CONTINENTAL_ADMIN,
  UserRole.NATIONAL_ADMIN,
  UserRole.DATA_STEWARD,
  UserRole.WAHIS_FOCAL_POINT,
] as const;

export async function registerSpsCertificateRoutes(app: FastifyInstance): Promise<void> {
  const authAndTenant = [app.authHookFn, tenantHook()];

  // POST /api/v1/trade/sps-certificates — create SPS certificate
  app.post<{ Body: CreateSpsCertificateInput }>('/api/v1/trade/sps-certificates', {
    schema: { body: CreateSpsCertificateSchema },
    preHandler: [...authAndTenant, rolesHook(...ALLOWED_ROLES)],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.spsCertificateService.create(request.body, user);
    return reply.code(201).send(result);
  });

  // GET /api/v1/trade/sps-certificates — list SPS certificates
  app.get<{ Querystring: SpsCertificateFilterInput }>('/api/v1/trade/sps-certificates', {
    schema: { querystring: SpsCertificateFilterSchema },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.spsCertificateService.findAll(user, request.query);
  });

  // GET /api/v1/trade/sps-certificates/:id — get SPS certificate by id
  app.get<{ Params: UuidParamInput }>('/api/v1/trade/sps-certificates/:id', {
    schema: { params: UuidParamSchema },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.spsCertificateService.findOne(request.params.id, user);
  });

  // PATCH /api/v1/trade/sps-certificates/:id — update SPS certificate
  app.patch<{ Params: UuidParamInput; Body: UpdateSpsCertificateInput }>('/api/v1/trade/sps-certificates/:id', {
    schema: { params: UuidParamSchema, body: UpdateSpsCertificateSchema },
    preHandler: [...authAndTenant, rolesHook(...ALLOWED_ROLES)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.spsCertificateService.update(request.params.id, request.body, user);
  });

  // POST /api/v1/trade/sps-certificates/:id/issue — issue SPS certificate
  app.post<{ Params: UuidParamInput }>('/api/v1/trade/sps-certificates/:id/issue', {
    schema: { params: UuidParamSchema },
    preHandler: [...authAndTenant, rolesHook(...ALLOWED_ROLES)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.spsCertificateService.issue(request.params.id, user);
  });
}

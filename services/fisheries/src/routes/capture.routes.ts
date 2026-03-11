import type { FastifyInstance } from 'fastify';
import { rolesHook, tenantHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  CreateCaptureSchema,
  UpdateCaptureSchema,
  CaptureFilterSchema,
  UuidParamSchema,
  type CreateCaptureInput,
  type UpdateCaptureInput,
  type CaptureFilterInput,
  type UuidParamInput,
} from '../schemas/capture.schema.js';

export async function registerCaptureRoutes(app: FastifyInstance): Promise<void> {
  const authAndTenant = [app.authHookFn, tenantHook()];

  // POST /api/v1/fisheries/captures
  app.post<{ Body: CreateCaptureInput }>('/api/v1/fisheries/captures', {
    schema: { body: CreateCaptureSchema },
    preHandler: [
      ...authAndTenant,
      rolesHook(
        UserRole.SUPER_ADMIN,
        UserRole.CONTINENTAL_ADMIN,
        UserRole.REC_ADMIN,
        UserRole.NATIONAL_ADMIN,
        UserRole.DATA_STEWARD,
        UserRole.FIELD_AGENT,
      ),
    ],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.captureService.create(request.body, user);
    return reply.code(201).send(result);
  });

  // GET /api/v1/fisheries/captures
  app.get<{ Querystring: CaptureFilterInput }>('/api/v1/fisheries/captures', {
    schema: { querystring: CaptureFilterSchema },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.captureService.findAll(user, request.query);
  });

  // GET /api/v1/fisheries/captures/:id
  app.get<{ Params: UuidParamInput }>('/api/v1/fisheries/captures/:id', {
    schema: { params: UuidParamSchema },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.captureService.findOne(request.params.id, user);
  });

  // PATCH /api/v1/fisheries/captures/:id
  app.patch<{ Params: UuidParamInput; Body: UpdateCaptureInput }>('/api/v1/fisheries/captures/:id', {
    schema: { params: UuidParamSchema, body: UpdateCaptureSchema },
    preHandler: [
      ...authAndTenant,
      rolesHook(
        UserRole.SUPER_ADMIN,
        UserRole.CONTINENTAL_ADMIN,
        UserRole.REC_ADMIN,
        UserRole.NATIONAL_ADMIN,
        UserRole.DATA_STEWARD,
      ),
    ],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.captureService.update(request.params.id, request.body, user);
  });
}

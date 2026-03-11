import type { FastifyInstance } from 'fastify';
import { rolesHook, tenantHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  CreateTrainingSchema,
  UpdateTrainingSchema,
  TrainingFilterSchema,
  UuidParamSchema,
  type CreateTrainingInput,
  type UpdateTrainingInput,
  type TrainingFilterInput,
  type UuidParamInput,
} from '../schemas/training.schema';

export async function registerTrainingRoutes(app: FastifyInstance): Promise<void> {
  const authAndTenant = [app.authHookFn, tenantHook()];

  // POST /api/v1/apiculture/training — create beekeeper training
  app.post<{ Body: CreateTrainingInput }>('/api/v1/apiculture/training', {
    schema: { body: CreateTrainingSchema },
    preHandler: [
      ...authAndTenant,
      rolesHook(
        UserRole.SUPER_ADMIN,
        UserRole.CONTINENTAL_ADMIN,
        UserRole.NATIONAL_ADMIN,
        UserRole.DATA_STEWARD,
        UserRole.FIELD_AGENT,
      ),
    ],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.trainingService.create(request.body, user);
    return reply.code(201).send(result);
  });

  // GET /api/v1/apiculture/training — list trainings
  app.get<{ Querystring: TrainingFilterInput }>('/api/v1/apiculture/training', {
    schema: { querystring: TrainingFilterSchema },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.trainingService.findAll(user, request.query);
  });

  // GET /api/v1/apiculture/training/:id — get training by id
  app.get<{ Params: UuidParamInput }>('/api/v1/apiculture/training/:id', {
    schema: { params: UuidParamSchema },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.trainingService.findOne(request.params.id, user);
  });

  // PATCH /api/v1/apiculture/training/:id — update training
  app.patch<{ Params: UuidParamInput; Body: UpdateTrainingInput }>('/api/v1/apiculture/training/:id', {
    schema: { params: UuidParamSchema, body: UpdateTrainingSchema },
    preHandler: [
      ...authAndTenant,
      rolesHook(
        UserRole.SUPER_ADMIN,
        UserRole.CONTINENTAL_ADMIN,
        UserRole.NATIONAL_ADMIN,
        UserRole.DATA_STEWARD,
      ),
    ],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.trainingService.update(request.params.id, request.body, user);
  });
}

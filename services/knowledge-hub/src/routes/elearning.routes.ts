import type { FastifyInstance } from 'fastify';
import { rolesHook } from '@aris/auth-middleware';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  CreateELearningSchema,
  UpdateELearningSchema,
  ELearningFilterSchema,
  UpdateProgressSchema,
  UuidParamSchema,
  type CreateELearningInput,
  type UpdateELearningInput,
  type ELearningFilterInput,
  type UpdateProgressInput,
  type UuidParamInput,
} from '../schemas/knowledge.schema';

const ADMIN_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.CONTINENTAL_ADMIN,
  UserRole.REC_ADMIN,
  UserRole.NATIONAL_ADMIN,
];

const PREFIX = '/api/v1/knowledge/elearning';

export async function registerELearningRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/v1/knowledge/elearning — create e-learning module
  app.post<{ Body: CreateELearningInput }>(PREFIX, {
    schema: { body: CreateELearningSchema },
    preHandler: [app.authHookFn, rolesHook(...ADMIN_ROLES)],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.elearningService.create(request.body, user);
    return reply.code(201).send(result);
  });

  // GET /api/v1/knowledge/elearning — list e-learning modules
  app.get<{ Querystring: ELearningFilterInput }>(PREFIX, {
    schema: { querystring: ELearningFilterSchema },
    preHandler: [app.authHookFn],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.elearningService.findAll(user, request.query);
  });

  // GET /api/v1/knowledge/elearning/my-courses — get current user's enrolled courses
  // NOTE: This must come before /:id to avoid matching "my-courses" as a UUID param
  app.get(`${PREFIX}/my-courses`, {
    preHandler: [app.authHookFn],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.elearningService.getMyCourses(user);
  });

  // GET /api/v1/knowledge/elearning/:id — get e-learning module by id
  app.get<{ Params: UuidParamInput }>(`${PREFIX}/:id`, {
    schema: { params: UuidParamSchema },
    preHandler: [app.authHookFn],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.elearningService.findOne(request.params.id, user);
  });

  // PATCH /api/v1/knowledge/elearning/:id — update e-learning module
  app.patch<{ Params: UuidParamInput; Body: UpdateELearningInput }>(`${PREFIX}/:id`, {
    schema: { params: UuidParamSchema, body: UpdateELearningSchema },
    preHandler: [app.authHookFn, rolesHook(...ADMIN_ROLES)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.elearningService.update(request.params.id, request.body, user);
  });

  // GET /api/v1/knowledge/elearning/:id/enroll — enroll in e-learning module
  app.get<{ Params: UuidParamInput }>(`${PREFIX}/:id/enroll`, {
    schema: { params: UuidParamSchema },
    preHandler: [app.authHookFn],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.elearningService.enroll(request.params.id, user);
  });

  // PATCH /api/v1/knowledge/elearning/:id/progress — update learning progress
  app.patch<{ Params: UuidParamInput; Body: UpdateProgressInput }>(`${PREFIX}/:id/progress`, {
    schema: { params: UuidParamSchema, body: UpdateProgressSchema },
    preHandler: [app.authHookFn],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.elearningService.updateProgress(request.params.id, request.body, user);
  });
}

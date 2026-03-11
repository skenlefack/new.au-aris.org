import type { FastifyInstance } from 'fastify';
import { rolesHook } from '@aris/auth-middleware';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  CreateFaqSchema,
  UpdateFaqSchema,
  FaqFilterSchema,
  UuidParamSchema,
  type CreateFaqInput,
  type UpdateFaqInput,
  type FaqFilterInput,
  type UuidParamInput,
} from '../schemas/knowledge.schema';

const ADMIN_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.CONTINENTAL_ADMIN,
  UserRole.REC_ADMIN,
  UserRole.NATIONAL_ADMIN,
];

const PREFIX = '/api/v1/knowledge/faq';

export async function registerFaqRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/v1/knowledge/faq — create FAQ
  app.post<{ Body: CreateFaqInput }>(PREFIX, {
    schema: { body: CreateFaqSchema },
    preHandler: [app.authHookFn, rolesHook(...ADMIN_ROLES)],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.faqService.create(request.body, user);
    return reply.code(201).send(result);
  });

  // GET /api/v1/knowledge/faq — list FAQs
  app.get<{ Querystring: FaqFilterInput }>(PREFIX, {
    schema: { querystring: FaqFilterSchema },
    preHandler: [app.authHookFn],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.faqService.findAll(user, request.query);
  });

  // GET /api/v1/knowledge/faq/:id — get FAQ by id
  app.get<{ Params: UuidParamInput }>(`${PREFIX}/:id`, {
    schema: { params: UuidParamSchema },
    preHandler: [app.authHookFn],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.faqService.findOne(request.params.id, user);
  });

  // PATCH /api/v1/knowledge/faq/:id — update FAQ
  app.patch<{ Params: UuidParamInput; Body: UpdateFaqInput }>(`${PREFIX}/:id`, {
    schema: { params: UuidParamSchema, body: UpdateFaqSchema },
    preHandler: [app.authHookFn, rolesHook(...ADMIN_ROLES)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.faqService.update(request.params.id, request.body, user);
  });
}

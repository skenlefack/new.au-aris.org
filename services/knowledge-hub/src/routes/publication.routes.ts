import type { FastifyInstance } from 'fastify';
import { rolesHook } from '@aris/auth-middleware';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  CreatePublicationSchema,
  UpdatePublicationSchema,
  PublicationFilterSchema,
  UuidParamSchema,
  type CreatePublicationInput,
  type UpdatePublicationInput,
  type PublicationFilterInput,
  type UuidParamInput,
} from '../schemas/knowledge.schema';

const ADMIN_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.CONTINENTAL_ADMIN,
  UserRole.REC_ADMIN,
  UserRole.NATIONAL_ADMIN,
];

const PREFIX = '/api/v1/knowledge/publications';

export async function registerPublicationRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/v1/knowledge/publications — create publication
  app.post<{ Body: CreatePublicationInput }>(PREFIX, {
    schema: { body: CreatePublicationSchema },
    preHandler: [app.authHookFn, rolesHook(...ADMIN_ROLES)],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.publicationService.create(request.body, user);
    return reply.code(201).send(result);
  });

  // GET /api/v1/knowledge/publications — list publications
  app.get<{ Querystring: PublicationFilterInput }>(PREFIX, {
    schema: { querystring: PublicationFilterSchema },
    preHandler: [app.authHookFn],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.publicationService.findAll(user, request.query);
  });

  // GET /api/v1/knowledge/publications/:id — get publication by id
  app.get<{ Params: UuidParamInput }>(`${PREFIX}/:id`, {
    schema: { params: UuidParamSchema },
    preHandler: [app.authHookFn],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.publicationService.findOne(request.params.id, user);
  });

  // PATCH /api/v1/knowledge/publications/:id — update publication
  app.patch<{ Params: UuidParamInput; Body: UpdatePublicationInput }>(`${PREFIX}/:id`, {
    schema: { params: UuidParamSchema, body: UpdatePublicationSchema },
    preHandler: [app.authHookFn, rolesHook(...ADMIN_ROLES)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.publicationService.update(request.params.id, request.body, user);
  });

  // GET /api/v1/knowledge/publications/:id/download — download publication file
  app.get<{ Params: UuidParamInput }>(`${PREFIX}/:id/download`, {
    schema: { params: UuidParamSchema },
    preHandler: [app.authHookFn],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.publicationService.download(request.params.id, user);
  });
}

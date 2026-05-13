import { readFileSync } from 'fs';
import type { FastifyInstance } from 'fastify';
import { UserRole } from '@aris/shared-types';
import { authHook, rolesHook, tenantHook } from '@aris/auth-middleware';
import type { AuthenticatedUser, AuthHookOptions } from '@aris/auth-middleware';
import { ReviewService } from '../services/review.service';

const WRITE_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.CONTINENTAL_ADMIN,
  UserRole.REC_ADMIN,
  UserRole.NATIONAL_ADMIN,
  UserRole.DATA_STEWARD,
];

function loadPublicKey(): string {
  let key = (process.env['JWT_PUBLIC_KEY'] ?? '').replace(/\\n/g, '\n');
  if (!key && process.env['JWT_PUBLIC_KEY_PATH']) {
    try { key = readFileSync(process.env['JWT_PUBLIC_KEY_PATH'], 'utf8'); } catch { /* ignore */ }
  }
  return key;
}

export default async function reviewRoutes(app: FastifyInstance): Promise<void> {
  const service = new ReviewService(app.prisma);

  const authOpts: AuthHookOptions = { publicKey: loadPublicKey() };
  const auth = authHook(authOpts);
  const tenant = tenantHook();

  // POST /api/v1/form-builder/reviews — create a review request
  app.post<{ Body: any }>('/api/v1/form-builder/reviews', {
    preHandler: [auth, tenant, rolesHook(...WRITE_ROLES)],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await service.createReview(request.body, user);
    return reply.code(201).send(result);
  });

  // GET /api/v1/form-builder/reviews — list my reviews (sent + received)
  app.get<{ Querystring: { page?: string; limit?: string; status?: string } }>('/api/v1/form-builder/reviews', {
    preHandler: [auth, tenant],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    const q = request.query;
    return service.findMyReviews(user, {
      page: q.page ? parseInt(q.page, 10) : undefined,
      limit: q.limit ? parseInt(q.limit, 10) : undefined,
      status: q.status,
    });
  });

  // GET /api/v1/form-builder/reviews/template/:templateId — reviews for a template
  app.get<{ Params: { templateId: string } }>('/api/v1/form-builder/reviews/template/:templateId', {
    preHandler: [auth, tenant],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return service.findByTemplate(request.params.templateId, user);
  });

  // GET /api/v1/form-builder/reviews/:id — get review with comments
  app.get<{ Params: { id: string } }>('/api/v1/form-builder/reviews/:id', {
    preHandler: [auth, tenant],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return service.findOne(request.params.id, user);
  });

  // POST /api/v1/form-builder/reviews/:id/comments — add comment
  app.post<{ Params: { id: string }; Body: { content: string; parentId?: string } }>('/api/v1/form-builder/reviews/:id/comments', {
    preHandler: [auth, tenant],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await service.addComment(request.params.id, request.body, user);
    return reply.code(201).send(result);
  });

  // PUT /api/v1/form-builder/reviews/:id/synthesis — compile synthesis
  app.put<{ Params: { id: string }; Body: { synthesis: string } }>('/api/v1/form-builder/reviews/:id/synthesis', {
    preHandler: [auth, tenant, rolesHook(...WRITE_ROLES)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return service.updateSynthesis(request.params.id, request.body.synthesis, user);
  });

  // POST /api/v1/form-builder/reviews/:id/close — close review
  app.post<{ Params: { id: string } }>('/api/v1/form-builder/reviews/:id/close', {
    preHandler: [auth, tenant, rolesHook(...WRITE_ROLES)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return service.closeReview(request.params.id, user);
  });
}

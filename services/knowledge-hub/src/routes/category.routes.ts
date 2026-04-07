import type { FastifyInstance } from 'fastify';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  CreateCategorySchema,
  UpdateCategorySchema,
  CategoryFilterSchema,
  ReviewCategorySchema,
  UuidParamSchema,
  type CreateCategoryInput,
  type UpdateCategoryInput,
  type CategoryFilterInput,
  type ReviewCategoryInput,
  type UuidParamInput,
} from '../schemas/knowledge.schema';

const PREFIX = '/api/v1/knowledge/categories';

export async function registerCategoryRoutes(app: FastifyInstance): Promise<void> {
  // ── Public listing (no auth) ────────────────────────────────────────────────
  // Used by the public Knowledge Portal landing page.
  app.get<{ Querystring: CategoryFilterInput & { withCounts?: boolean; tree?: boolean } }>(
    `${PREFIX}/public`,
    { schema: { querystring: CategoryFilterSchema } },
    async (request) => {
      const { tree, withCounts, ...filters } = request.query as any;
      if (tree) return app.categoryService.tree({ ...filters, withCounts: !!withCounts }, null);
      return app.categoryService.list(filters, null);
    },
  );

  app.get<{ Params: { slug: string } }>(`${PREFIX}/public/by-slug/:slug`, async (request) => {
    return app.categoryService.findBySlug(request.params.slug, null);
  });

  // ── Authenticated listing & tree ────────────────────────────────────────────
  app.get<{ Querystring: CategoryFilterInput & { tree?: boolean; withCounts?: boolean } }>(
    PREFIX,
    {
      schema: { querystring: CategoryFilterSchema },
      preHandler: [app.authHookFn],
    },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      const { tree, withCounts, ...filters } = request.query as any;
      if (tree) return app.categoryService.tree({ ...filters, withCounts: !!withCounts }, user);
      return app.categoryService.list(filters, user);
    },
  );

  // Categories the user is allowed to publish in (form picker)
  app.get(`${PREFIX}/publishable`, { preHandler: [app.authHookFn] }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.categoryService.listPublishable(user);
  });

  // ── Continental review queue (KNOWLEDGE_MANAGER + continental roles) ─────
  app.get(`${PREFIX}/review-queue`, { preHandler: [app.authHookFn] }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.categoryService.reviewQueue(user);
  });

  app.post<{ Params: UuidParamInput; Body: ReviewCategoryInput }>(
    `${PREFIX}/:id/review`,
    {
      schema: { params: UuidParamSchema, body: ReviewCategorySchema },
      preHandler: [app.authHookFn],
    },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      return app.categoryService.review(
        request.params.id,
        request.body.decision,
        request.body.comment,
        user,
      );
    },
  );

  app.get<{ Params: UuidParamInput }>(
    `${PREFIX}/:id`,
    { schema: { params: UuidParamSchema }, preHandler: [app.authHookFn] },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      return app.categoryService.findById(request.params.id, user);
    },
  );

  // ── Management (KNOWLEDGE_MANAGER + continental roles) ──────────────────────
  app.post<{ Body: CreateCategoryInput }>(
    PREFIX,
    {
      schema: { body: CreateCategorySchema },
      preHandler: [app.authHookFn],
    },
    async (request, reply) => {
      const user = request.user as AuthenticatedUser;
      const result = await app.categoryService.create(request.body, user);
      return reply.code(201).send(result);
    },
  );

  app.patch<{ Params: UuidParamInput; Body: UpdateCategoryInput }>(
    `${PREFIX}/:id`,
    {
      schema: { params: UuidParamSchema, body: UpdateCategorySchema },
      preHandler: [app.authHookFn],
    },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      return app.categoryService.update(request.params.id, request.body, user);
    },
  );

  app.delete<{ Params: UuidParamInput }>(
    `${PREFIX}/:id`,
    {
      schema: { params: UuidParamSchema },
      preHandler: [app.authHookFn],
    },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      return app.categoryService.delete(request.params.id, user);
    },
  );
}

import type { FastifyInstance } from 'fastify';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  CreatePublicationSchema,
  UpdatePublicationSchema,
  PublicationFilterSchema,
  ReviewPublicationSchema,
  PublicSearchSchema,
  UuidParamSchema,
  type CreatePublicationInput,
  type UpdatePublicationInput,
  type PublicationFilterInput,
  type ReviewPublicationInput,
  type PublicSearchInput,
  type UuidParamInput,
} from '../schemas/knowledge.schema';

const PREFIX = '/api/v1/knowledge/publications';

export async function registerPublicationRoutes(app: FastifyInstance): Promise<void> {
  // ─────────────────────────────────────────────────────────────
  // Public (no auth) — only PUBLISHED + visibility=PUBLIC
  // ─────────────────────────────────────────────────────────────

  // Public KPI counters for the landing page
  app.get(`${PREFIX}/public/stats`, async () => {
    return app.publicationService.publicStats();
  });

  // Public list / search (delegates to PublicationService.findAll without user)
  app.get<{ Querystring: PublicSearchInput }>(
    `${PREFIX}/public`,
    { schema: { querystring: PublicSearchSchema } },
    async (request) => {
      const { q, page, limit, categoryId, type } = request.query;
      return app.publicationService.findAll(null, {
        page, limit, categoryId, type,
        search: q,
      } as PublicationFilterInput);
    },
  );

  app.get<{ Params: { slug: string } }>(`${PREFIX}/public/by-slug/:slug`, async (request) => {
    return app.publicationService.findBySlug(request.params.slug, null);
  });

  app.get<{ Params: UuidParamInput }>(
    `${PREFIX}/public/:id`,
    { schema: { params: UuidParamSchema } },
    async (request) => app.publicationService.findOne(request.params.id, null),
  );

  // ─────────────────────────────────────────────────────────────
  // Authenticated
  // ─────────────────────────────────────────────────────────────

  // Reviewer queue (must precede /:id)
  app.get(`${PREFIX}/review-queue`, { preHandler: [app.authHookFn] }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.publicationService.reviewQueue(user);
  });

  // List
  app.get<{ Querystring: PublicationFilterInput }>(
    PREFIX,
    {
      schema: { querystring: PublicationFilterSchema },
      preHandler: [app.authHookFn],
    },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      return app.publicationService.findAll(user, request.query);
    },
  );

  // Read by id
  app.get<{ Params: UuidParamInput }>(
    `${PREFIX}/:id`,
    { schema: { params: UuidParamSchema }, preHandler: [app.authHookFn] },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      return app.publicationService.findOne(request.params.id, user);
    },
  );

  // Create
  app.post<{ Body: CreatePublicationInput }>(
    PREFIX,
    {
      schema: { body: CreatePublicationSchema },
      preHandler: [app.authHookFn],
    },
    async (request, reply) => {
      const user = request.user as AuthenticatedUser;
      const result = await app.publicationService.create(request.body, user);
      return reply.code(201).send(result);
    },
  );

  // Update
  app.patch<{ Params: UuidParamInput; Body: UpdatePublicationInput }>(
    `${PREFIX}/:id`,
    {
      schema: { params: UuidParamSchema, body: UpdatePublicationSchema },
      preHandler: [app.authHookFn],
    },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      return app.publicationService.update(request.params.id, request.body, user);
    },
  );

  // Delete
  app.delete<{ Params: UuidParamInput }>(
    `${PREFIX}/:id`,
    {
      schema: { params: UuidParamSchema },
      preHandler: [app.authHookFn],
    },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      return app.publicationService.delete(request.params.id, user);
    },
  );

  // ─── Workflow transitions ────────────────────────────────────
  app.post<{ Params: UuidParamInput }>(
    `${PREFIX}/:id/submit`,
    { schema: { params: UuidParamSchema }, preHandler: [app.authHookFn] },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      return app.publicationService.submit(request.params.id, user);
    },
  );

  app.post<{ Params: UuidParamInput; Body: ReviewPublicationInput }>(
    `${PREFIX}/:id/review`,
    {
      schema: { params: UuidParamSchema, body: ReviewPublicationSchema },
      preHandler: [app.authHookFn],
    },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      return app.publicationService.review(request.params.id, request.body, user);
    },
  );

  app.post<{ Params: UuidParamInput }>(
    `${PREFIX}/:id/publish`,
    { schema: { params: UuidParamSchema }, preHandler: [app.authHookFn] },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      return app.publicationService.publish(request.params.id, user);
    },
  );

  app.post<{ Params: UuidParamInput }>(
    `${PREFIX}/:id/archive`,
    { schema: { params: UuidParamSchema }, preHandler: [app.authHookFn] },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      return app.publicationService.archive(request.params.id, user);
    },
  );
}

/**
 * slideshow.routes.ts — REST routes for dashboard slideshows.
 *
 * Routes:
 *   GET    /slideshows                         — list slideshows
 *   POST   /slideshows                         — create
 *   GET    /slideshows/:id                     — get by id
 *   PATCH  /slideshows/:id                     — update config
 *   DELETE /slideshows/:id                     — delete
 *   PUT    /slideshows/:id/slides              — replace slides
 *   POST   /slideshows/:id/regenerate-token    — regenerate public link
 *   GET    /slideshows/public/:token            — public kiosk view (no auth)
 *   GET    /slideshows/public/:token/render     — public render with widget data (no auth)
 */

import { Type } from '@sinclair/typebox';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { tenantHook } from '@aris/auth-middleware/fastify';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  CreateSlideshowSchema,
  UpdateSlideshowSchema,
  UpdateSlidesSchema,
  ListSlideshowsQuerySchema,
} from './slideshow.schemas';
import type {
  CreateSlideshowDto,
  UpdateSlideshowDto,
  UpdateSlidesDto,
  ListSlideshowsQuery,
  SlideshowIdParam,
} from './slideshow.schemas';

export async function registerSlideshowRoutes(app: FastifyInstance): Promise<void> {
  const PREFIX = '/api/v1/analytics/slideshows';

  // ═══════════════════════════════════════════════════════════════════════
  //  Public — kiosk view (no auth)
  // ═══════════════════════════════════════════════════════════════════════

  app.get(`${PREFIX}/public/:token`, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { token: string };
    const data = await app.slideshowService.getByPublicToken(params.token);
    return reply.code(200).send({ data });
  });

  // Public render — resolves widget data for each slide's dashboard
  app.get(`${PREFIX}/public/:token/render`, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { token: string };
    const slideshow = await app.slideshowService.getByPublicToken(params.token) as any;
    const slides = slideshow.slides || [];

    // Resolve each dashboard's widgets in parallel
    const renderedSlides = await Promise.all(
      slides.map(async (slide: any) => {
        try {
          const rendered = await app.widgetResolver.renderDashboard(
            slide.dashboardId,
            undefined as any,
            {},
          );
          return { ...slide, dashboard: rendered };
        } catch {
          return { ...slide, dashboard: null };
        }
      }),
    );

    return reply.code(200).send({
      data: {
        ...slideshow,
        slides: renderedSlides,
      },
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  Authenticated CRUD
  // ═══════════════════════════════════════════════════════════════════════

  app.get(PREFIX, {
    preHandler: [app.authHookFn, tenantHook()],
    schema: { querystring: ListSlideshowsQuerySchema } as any,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as ListSlideshowsQuery;
    const user = request.user as AuthenticatedUser;
    const result = await app.slideshowService.list(query, user.tenantId);
    return reply.code(200).send(result);
  });

  app.post(PREFIX, {
    preHandler: [app.authHookFn, tenantHook()],
    schema: { body: CreateSlideshowSchema } as any,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as CreateSlideshowDto;
    const user = request.user as AuthenticatedUser;
    const data = await app.slideshowService.create(body, user.userId, user.tenantId);
    return reply.code(201).send({ data });
  });

  app.get(`${PREFIX}/:id`, {
    preHandler: [app.authHookFn, tenantHook()],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as SlideshowIdParam;
    const data = await app.slideshowService.getById(params.id);
    return reply.code(200).send({ data });
  });

  app.patch(`${PREFIX}/:id`, {
    preHandler: [app.authHookFn, tenantHook()],
    schema: { body: UpdateSlideshowSchema } as any,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as SlideshowIdParam;
    const body = request.body as UpdateSlideshowDto;
    const user = request.user as AuthenticatedUser;
    const data = await app.slideshowService.update(params.id, body, user.userId);
    return reply.code(200).send({ data });
  });

  app.delete(`${PREFIX}/:id`, {
    preHandler: [app.authHookFn, tenantHook()],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as SlideshowIdParam;
    const user = request.user as AuthenticatedUser;
    await app.slideshowService.delete(params.id, user.userId);
    return reply.code(204).send();
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  Slides management
  // ═══════════════════════════════════════════════════════════════════════

  app.put(`${PREFIX}/:id/slides`, {
    preHandler: [app.authHookFn, tenantHook()],
    schema: { body: UpdateSlidesSchema } as any,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as SlideshowIdParam;
    const body = request.body as UpdateSlidesDto;
    const user = request.user as AuthenticatedUser;
    const data = await app.slideshowService.updateSlides(params.id, body, user.userId);
    return reply.code(200).send({ data });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  Regenerate public token
  // ═══════════════════════════════════════════════════════════════════════

  app.post(`${PREFIX}/:id/regenerate-token`, {
    preHandler: [app.authHookFn, tenantHook()],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as SlideshowIdParam;
    const user = request.user as AuthenticatedUser;
    const data = await app.slideshowService.regenerateToken(params.id, user.userId);
    return reply.code(200).send({ data });
  });
}

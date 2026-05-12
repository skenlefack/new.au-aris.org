/**
 * dashboard.routes.ts — REST routes for dashboard builder within analytics service.
 *
 * Routes:
 *   GET    /dashboards                              — list dashboards
 *   GET    /dashboards/default-for                   — default dashboard for scope/target
 *   GET    /dashboards/:id                           — get dashboard by id
 *   GET    /dashboards/:id/render                    — render dashboard with live data
 *   POST   /dashboards                              — create (optionally clone)
 *   PATCH  /dashboards/:id                           — update
 *   DELETE /dashboards/:id                           — delete
 *
 *   POST   /dashboards/:id/widgets                  — add widget
 *   PATCH  /dashboards/:id/widgets/:widgetId        — update widget
 *   POST   /dashboards/:id/widgets/batch            — batch update positions
 *   DELETE /dashboards/:id/widgets/:widgetId        — remove widget
 *
 *   GET    /dashboards/:id/shares                   — list active shares
 *   POST   /dashboards/:id/share                    — share dashboard
 *   PATCH  /dashboards/:id/share/:shareId           — update share
 *   DELETE /dashboards/:id/share/:shareId           — revoke share (soft)
 *
 *   POST   /dashboards/preferences                  — set user preference
 */

import { Type } from '@sinclair/typebox';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { tenantHook, rolesHook } from '@aris/auth-middleware/fastify';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { UserRole } from '@aris/shared-types';
import {
  DashboardScopeSchema,
  CreateDashboardSchema,
  UpdateDashboardSchema,
  CreateWidgetSchema,
  UpdateWidgetSchema,
  BatchUpdateWidgetsSchema,
  SaveLayoutSchema,
  CreateShareSchema,
  UpdateShareSchema,
  ListSharesQuerySchema,
  SetPreferenceSchema,
  ListDashboardsQuerySchema,
  DefaultForQuerySchema,
  RenderQuerySchema,
} from './dashboard.schemas';
import type {
  CreateDashboardDto,
  UpdateDashboardDto,
  CreateWidgetDto,
  UpdateWidgetDto,
  BatchUpdateWidgetsDto,
  SaveLayoutDto,
  CreateShareDto,
  UpdateShareDto,
  ListSharesQuery,
  SetPreferenceDto,
  ListDashboardsQuery,
  DefaultForQuery,
  RenderQuery,
  WidgetIdParam,
  ShareIdParam,
  DashboardIdParam,
} from './dashboard.schemas';

const ADMIN_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.CONTINENTAL_ADMIN,
];

export async function registerDashboardRoutes(app: FastifyInstance): Promise<void> {
  const PREFIX = '/api/v1/analytics/dashboards';

  // ═══════════════════════════════════════════════════════════════════════
  //  Public dashboard (no auth — for public REC/Country pages)
  // ═══════════════════════════════════════════════════════════════════════

  app.get(`${PREFIX}/public`, {
    schema: {
      querystring: Type.Object({
        scope: DashboardScopeSchema,
        recCode: Type.Optional(Type.String({ maxLength: 20 })),
        countryCode: Type.Optional(Type.String({ maxLength: 2 })),
      }),
      tags: ['dashboards'],
    },
  }, async (
    request: FastifyRequest<{ Querystring: { scope: string; recCode?: string; countryCode?: string } }>,
    reply: FastifyReply,
  ) => {
    const { scope, recCode, countryCode } = request.query;
    const result = await app.dashboardService.list(
      { scope, recCode, countryCode, ownership: 'USER_OWNED', limit: 1 },
      undefined, undefined, undefined, // no user context — public
    );
    const dashboard = result.data?.[0];
    if (!dashboard) {
      return reply.code(200).send({ data: null });
    }
    // Render with widget data
    try {
      const rendered = await app.widgetResolver.renderDashboard(
        (dashboard as any).id,
        undefined,
        { recCode, countryCode },
      );
      return reply.code(200).send({ data: rendered });
    } catch {
      return reply.code(200).send({ data: { ...(dashboard as any), sections: [], widgetData: {} } });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  Dashboards
  // ═══════════════════════════════════════════════════════════════════════

  app.get(PREFIX, {
    preHandler: [app.authHookFn, tenantHook()],
    schema: { querystring: ListDashboardsQuerySchema, tags: ['dashboards'] },
  }, async (
    request: FastifyRequest<{ Querystring: ListDashboardsQuery }>,
    reply: FastifyReply,
  ) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.dashboardService.list(request.query, user.userId, user.role, user.tenantId);
    return reply.code(200).send(result);
  });

  app.get(`${PREFIX}/default-for`, {
    preHandler: [app.authHookFn, tenantHook()],
    schema: { querystring: DefaultForQuerySchema, tags: ['dashboards'] },
  }, async (
    request: FastifyRequest<{ Querystring: DefaultForQuery }>,
    reply: FastifyReply,
  ) => {
    const user = request.user as AuthenticatedUser;
    const data = await app.dashboardService.getDefaultFor(user.userId, request.query);
    if (!data) {
      return reply.code(404).send({ statusCode: 404, message: 'No default dashboard found for this scope' });
    }
    return reply.code(200).send({ data });
  });

  app.get(`${PREFIX}/:id`, {
    preHandler: [app.authHookFn, tenantHook()],
    schema: { tags: ['dashboards'] },
  }, async (
    request: FastifyRequest<{ Params: DashboardIdParam }>,
    reply: FastifyReply,
  ) => {
    const user = request.user as AuthenticatedUser;
    const data = await app.dashboardService.getById(request.params.id, user.userId, user.role, user.tenantId);
    return reply.code(200).send({ data });
  });

  app.get(`${PREFIX}/:id/render`, {
    preHandler: [app.authHookFn, tenantHook()],
    schema: { querystring: RenderQuerySchema, tags: ['dashboards'] },
  }, async (
    request: FastifyRequest<{ Params: DashboardIdParam; Querystring: RenderQuery }>,
    reply: FastifyReply,
  ) => {
    const user = request.user as AuthenticatedUser;
    const data = await app.widgetResolver.renderDashboard(
      request.params.id,
      user.userId,
      request.query,
    );
    return reply.code(200).send({ data });
  });

  app.post(PREFIX, {
    preHandler: [app.authHookFn, tenantHook()],
    schema: { body: CreateDashboardSchema, tags: ['dashboards'] },
  }, async (
    request: FastifyRequest<{ Body: CreateDashboardDto }>,
    reply: FastifyReply,
  ) => {
    const user = request.user as AuthenticatedUser;
    const data = await app.dashboardService.create(request.body, user.userId);
    return reply.code(201).send({ data });
  });

  app.patch(`${PREFIX}/:id`, {
    preHandler: [app.authHookFn, tenantHook()],
    schema: { body: UpdateDashboardSchema, tags: ['dashboards'] },
  }, async (
    request: FastifyRequest<{ Params: DashboardIdParam; Body: UpdateDashboardDto }>,
    reply: FastifyReply,
  ) => {
    const user = request.user as AuthenticatedUser;
    const data = await app.dashboardService.update(request.params.id, request.body, user.userId);
    return reply.code(200).send({ data });
  });

  app.delete(`${PREFIX}/:id`, {
    preHandler: [app.authHookFn, tenantHook()],
    schema: { tags: ['dashboards'] },
  }, async (
    request: FastifyRequest<{ Params: DashboardIdParam }>,
    reply: FastifyReply,
  ) => {
    const user = request.user as AuthenticatedUser;
    await app.dashboardService.delete(request.params.id, user.userId);
    return reply.code(204).send();
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  Widgets
  // ═══════════════════════════════════════════════════════════════════════

  app.post(`${PREFIX}/:id/widgets`, {
    preHandler: [app.authHookFn, tenantHook()],
    schema: { body: CreateWidgetSchema, tags: ['dashboards'] },
  }, async (
    request: FastifyRequest<{ Params: DashboardIdParam; Body: CreateWidgetDto }>,
    reply: FastifyReply,
  ) => {
    const user = request.user as AuthenticatedUser;
    const data = await app.dashboardService.addWidget(request.params.id, request.body, user.userId);
    return reply.code(201).send({ data });
  });

  app.patch(`${PREFIX}/:id/widgets/:widgetId`, {
    preHandler: [app.authHookFn, tenantHook()],
    schema: { body: UpdateWidgetSchema, tags: ['dashboards'] },
  }, async (
    request: FastifyRequest<{ Params: WidgetIdParam; Body: UpdateWidgetDto }>,
    reply: FastifyReply,
  ) => {
    const user = request.user as AuthenticatedUser;
    const data = await app.dashboardService.updateWidget(
      request.params.id,
      request.params.widgetId,
      request.body,
      user.userId,
    );
    return reply.code(200).send({ data });
  });

  app.post(`${PREFIX}/:id/widgets/batch`, {
    preHandler: [app.authHookFn, tenantHook()],
    schema: { body: BatchUpdateWidgetsSchema, tags: ['dashboards'] },
  }, async (
    request: FastifyRequest<{ Params: DashboardIdParam; Body: BatchUpdateWidgetsDto }>,
    reply: FastifyReply,
  ) => {
    const user = request.user as AuthenticatedUser;
    const data = await app.dashboardService.batchUpdateWidgets(
      request.params.id,
      request.body,
      user.userId,
    );
    return reply.code(200).send({ data });
  });

  app.delete(`${PREFIX}/:id/widgets/:widgetId`, {
    preHandler: [app.authHookFn, tenantHook()],
    schema: { tags: ['dashboards'] },
  }, async (
    request: FastifyRequest<{ Params: WidgetIdParam }>,
    reply: FastifyReply,
  ) => {
    const user = request.user as AuthenticatedUser;
    await app.dashboardService.removeWidget(request.params.id, request.params.widgetId, user.userId);
    return reply.code(204).send();
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  Layout (sections + widget positions — bulk save)
  // ═══════════════════════════════════════════════════════════════════════

  app.post(`${PREFIX}/:id/layout`, {
    preHandler: [app.authHookFn, tenantHook()],
    schema: { body: SaveLayoutSchema, tags: ['dashboards'] },
  }, async (
    request: FastifyRequest<{ Params: DashboardIdParam; Body: SaveLayoutDto }>,
    reply: FastifyReply,
  ) => {
    const user = request.user as AuthenticatedUser;
    const data = await app.dashboardService.saveLayout(
      request.params.id,
      request.body,
      user.userId,
    );
    return reply.code(200).send({ data });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  Shares
  // ═══════════════════════════════════════════════════════════════════════

  // GET /dashboards/:id/shares — list active shares
  app.get(`${PREFIX}/:id/shares`, {
    preHandler: [app.authHookFn, tenantHook()],
    schema: { querystring: ListSharesQuerySchema, tags: ['dashboards'] },
  }, async (
    request: FastifyRequest<{ Params: DashboardIdParam; Querystring: ListSharesQuery }>,
    reply: FastifyReply,
  ) => {
    const user = request.user as AuthenticatedUser;
    const query = request.query as ListSharesQuery;
    const data = await app.dashboardService.listShares(request.params.id, user.userId, query.page, query.limit);
    return reply.send(data);
  });

  // PATCH /dashboards/:id/share/:shareId — update share
  app.patch(`${PREFIX}/:id/share/:shareId`, {
    preHandler: [app.authHookFn, tenantHook()],
    schema: { body: UpdateShareSchema, tags: ['dashboards'] },
  }, async (
    request: FastifyRequest<{ Params: ShareIdParam; Body: UpdateShareDto }>,
    reply: FastifyReply,
  ) => {
    const user = request.user as AuthenticatedUser;
    const data = await app.dashboardService.updateShare(request.params.id, request.params.shareId, request.body, user.userId);
    return reply.send({ data });
  });

  app.post(`${PREFIX}/:id/share`, {
    preHandler: [app.authHookFn, tenantHook()],
    schema: { body: CreateShareSchema, tags: ['dashboards'] },
  }, async (
    request: FastifyRequest<{ Params: DashboardIdParam; Body: CreateShareDto }>,
    reply: FastifyReply,
  ) => {
    const user = request.user as AuthenticatedUser;
    const data = await app.dashboardService.share(request.params.id, request.body, user.userId);
    return reply.code(201).send({ data });
  });

  app.delete(`${PREFIX}/:id/share/:shareId`, {
    preHandler: [app.authHookFn, tenantHook()],
    schema: { tags: ['dashboards'] },
  }, async (
    request: FastifyRequest<{ Params: ShareIdParam }>,
    reply: FastifyReply,
  ) => {
    const user = request.user as AuthenticatedUser;
    await app.dashboardService.removeShare(request.params.id, request.params.shareId, user.userId);
    return reply.code(204).send();
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  Preferences
  // ═══════════════════════════════════════════════════════════════════════

  app.post(`${PREFIX}/preferences`, {
    preHandler: [app.authHookFn, tenantHook()],
    schema: { body: SetPreferenceSchema, tags: ['dashboards'] },
  }, async (
    request: FastifyRequest<{ Body: SetPreferenceDto }>,
    reply: FastifyReply,
  ) => {
    const user = request.user as AuthenticatedUser;
    const data = await app.dashboardService.setPreference(user.userId, request.body);
    return reply.code(200).send({ data });
  });
}

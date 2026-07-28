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
    } as any,
  }, async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    const { scope, recCode, countryCode } = request.query as { scope?: string; recCode?: string; countryCode?: string };
    const result = await app.dashboardService.list(
      { scope, recCode, countryCode, ownership: 'USER_OWNED', limit: 1 } as any,
      undefined as any, undefined, undefined, // no user context — public
    );
    const dashboard = result.data?.[0];
    if (!dashboard) {
      return reply.code(200).send({ data: null });
    }
    // Render with widget data
    try {
      const rendered = await app.widgetResolver.renderDashboard(
        (dashboard as any).id,
        undefined as any,
        { recCode, countryCode },
      );
      return reply.code(200).send({ data: rendered });
    } catch {
      return reply.code(200).send({ data: { ...(dashboard as any), sections: [], widgetData: {} } });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  Query Catalogue — available query types for ANALYTICS_QUERY widgets
  // ═══════════════════════════════════════════════════════════════════════

  app.get(`${PREFIX}/query-catalogue`, {
    preHandler: [app.authHookFn, tenantHook()],
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.code(200).send({
      data: {
        queryTypes: [
          {
            code: 'submissions_by_country',
            labelFr: 'Soumissions par pays',
            labelEn: 'Submissions by country',
            description: 'Number of form submissions grouped by country code',
            params: ['domain'],
            groupBy: ['country'],
            suggestedWidgets: ['BAR_CHART', 'PIE_CHART', 'MAP_AFRICA', 'TABLE', 'RANKED_LIST'],
          },
          {
            code: 'submissions_by_domain',
            labelFr: 'Soumissions par domaine',
            labelEn: 'Submissions by domain',
            description: 'Submissions count grouped by business domain',
            params: [],
            groupBy: ['domain'],
            suggestedWidgets: ['PIE_CHART', 'BAR_CHART', 'TABLE'],
          },
          {
            code: 'submissions_timeline',
            labelFr: 'Tendance des soumissions',
            labelEn: 'Submissions timeline',
            description: 'Submissions over time (month, week, quarter, year)',
            params: ['domain'],
            groupBy: ['month', 'week', 'quarter', 'year'],
            suggestedWidgets: ['LINE_CHART', 'AREA_CHART', 'BAR_CHART', 'EPI_CURVE'],
          },
          {
            code: 'domain_kpis',
            labelFr: 'KPIs par domaine',
            labelEn: 'Domain KPIs',
            description: 'Indicator values for a specific domain',
            params: ['domain'],
            groupBy: ['country', 'indicator'],
            suggestedWidgets: ['KPI_CARD', 'TABLE', 'BAR_CHART'],
          },
          {
            code: 'continental_summary',
            labelFr: 'Résumé continental',
            labelEn: 'Continental summary',
            description: 'Total submissions, active countries, active domains, form count',
            params: [],
            groupBy: [],
            suggestedWidgets: ['KPI_CARD', 'STAT_CARD', 'COUNTER'],
          },
          {
            code: 'form_field_distribution',
            labelFr: 'Distribution d\'un champ',
            labelEn: 'Form field distribution',
            description: 'Distribution of values for a specific form field',
            params: ['formId', 'field'],
            groupBy: ['field_value', 'country'],
            suggestedWidgets: ['PIE_CHART', 'BAR_CHART', 'RANKED_LIST'],
          },
          {
            code: 'form_time_series',
            labelFr: 'Série temporelle formulaire',
            labelEn: 'Form time series',
            description: 'Time series of form submissions or field aggregation',
            params: ['formId'],
            groupBy: ['month', 'week', 'quarter', 'year'],
            suggestedWidgets: ['LINE_CHART', 'AREA_CHART', 'BAR_CHART'],
          },
          {
            code: 'historical_aggregate',
            labelFr: 'Données historiques agrégées',
            labelEn: 'Historical data aggregate',
            description: 'Aggregation from imported historical datasets (datalake)',
            params: ['domain'],
            groupBy: ['country', 'year', 'month', 'disease', 'species'],
            suggestedWidgets: ['BAR_CHART', 'LINE_CHART', 'TABLE', 'HEATMAP'],
          },
          {
            code: 'cross_domain_comparison',
            labelFr: 'Comparaison inter-domaines',
            labelEn: 'Cross-domain comparison',
            description: 'Compare submissions and activity across all domains',
            params: [],
            groupBy: ['domain'],
            suggestedWidgets: ['BAR_CHART', 'PIE_CHART', 'STACKED_BAR', 'TABLE'],
          },
        ],
        domains: [
          { code: 'animal-health', labelFr: 'Santé animale', labelEn: 'Animal Health' },
          { code: 'livestock-prod', labelFr: 'Élevage & Production', labelEn: 'Livestock & Production' },
          { code: 'fisheries', labelFr: 'Pêche & Aquaculture', labelEn: 'Fisheries & Aquaculture' },
          { code: 'trade-sps', labelFr: 'Commerce & SPS', labelEn: 'Trade & SPS' },
          { code: 'governance', labelFr: 'Gouvernance', labelEn: 'Governance & Capacities' },
          { code: 'wildlife', labelFr: 'Faune sauvage', labelEn: 'Wildlife & Biodiversity' },
          { code: 'apiculture', labelFr: 'Apiculture', labelEn: 'Apiculture & Pollination' },
          { code: 'climate-env', labelFr: 'Climat & Environnement', labelEn: 'Climate & Environment' },
          { code: 'paid', labelFr: 'PAID', labelEn: 'PAID' },
        ],
        groupByOptions: [
          { code: 'country', labelFr: 'Pays', labelEn: 'Country' },
          { code: 'domain', labelFr: 'Domaine', labelEn: 'Domain' },
          { code: 'month', labelFr: 'Mois', labelEn: 'Month' },
          { code: 'week', labelFr: 'Semaine', labelEn: 'Week' },
          { code: 'quarter', labelFr: 'Trimestre', labelEn: 'Quarter' },
          { code: 'year', labelFr: 'Année', labelEn: 'Year' },
          { code: 'disease', labelFr: 'Maladie', labelEn: 'Disease' },
          { code: 'species', labelFr: 'Espèce', labelEn: 'Species' },
          { code: 'status', labelFr: 'Statut', labelEn: 'Status' },
          { code: 'rec', labelFr: 'CER', labelEn: 'REC' },
        ],
        metrics: [
          { code: 'count', labelFr: 'Nombre', labelEn: 'Count' },
          { code: 'sum', labelFr: 'Somme', labelEn: 'Sum' },
          { code: 'avg', labelFr: 'Moyenne', labelEn: 'Average' },
          { code: 'min', labelFr: 'Minimum', labelEn: 'Min' },
          { code: 'max', labelFr: 'Maximum', labelEn: 'Max' },
        ],
        sortOptions: [
          { code: 'value_desc', labelFr: 'Valeur décroissante', labelEn: 'Value descending' },
          { code: 'value_asc', labelFr: 'Valeur croissante', labelEn: 'Value ascending' },
          { code: 'name_asc', labelFr: 'Nom A→Z', labelEn: 'Name A→Z' },
          { code: 'name_desc', labelFr: 'Nom Z→A', labelEn: 'Name Z→A' },
        ],
      },
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  Dashboards
  // ═══════════════════════════════════════════════════════════════════════

  app.get(PREFIX, {
    preHandler: [app.authHookFn, tenantHook()],
    schema: { querystring: ListDashboardsQuerySchema } as any,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthenticatedUser;
    const result = await app.dashboardService.list(request.query as ListDashboardsQuery, user.userId, user.role, user.tenantId);
    return reply.code(200).send(result);
  });

  app.get(`${PREFIX}/default-for`, {
    preHandler: [app.authHookFn, tenantHook()],
    schema: { querystring: DefaultForQuerySchema } as any,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthenticatedUser;
    const data = await app.dashboardService.getDefaultFor(user.userId, request.query as DefaultForQuery);
    if (!data) {
      return reply.code(404).send({ statusCode: 404, message: 'No default dashboard found for this scope' });
    }
    return reply.code(200).send({ data });
  });

  app.get(`${PREFIX}/:id`, {
    preHandler: [app.authHookFn, tenantHook()],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthenticatedUser;
    const { id } = request.params as DashboardIdParam;
    const data = await app.dashboardService.getById(id, user.userId, user.role, user.tenantId);
    return reply.code(200).send({ data });
  });

  app.get(`${PREFIX}/:id/render`, {
    preHandler: [app.authHookFn, tenantHook()],
    schema: { querystring: RenderQuerySchema } as any,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthenticatedUser;
    const { id } = request.params as DashboardIdParam;
    const data = await app.widgetResolver.renderDashboard(
      id,
      user.userId,
      request.query as RenderQuery,
    );
    return reply.code(200).send({ data });
  });

  app.post(PREFIX, {
    preHandler: [app.authHookFn, tenantHook()],
    schema: { body: CreateDashboardSchema } as any,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthenticatedUser;
    const data = await app.dashboardService.create(request.body as CreateDashboardDto, user.userId);
    return reply.code(201).send({ data });
  });

  app.patch(`${PREFIX}/:id`, {
    preHandler: [app.authHookFn, tenantHook()],
    schema: { body: UpdateDashboardSchema } as any,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthenticatedUser;
    const { id } = request.params as DashboardIdParam;
    const data = await app.dashboardService.update(id, request.body as UpdateDashboardDto, user.userId);
    return reply.code(200).send({ data });
  });

  app.delete(`${PREFIX}/:id`, {
    preHandler: [app.authHookFn, tenantHook()],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthenticatedUser;
    const { id } = request.params as DashboardIdParam;
    await app.dashboardService.delete(id, user.userId, user.role);
    return reply.code(204).send();
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  Widgets
  // ═══════════════════════════════════════════════════════════════════════

  app.post(`${PREFIX}/:id/widgets`, {
    preHandler: [app.authHookFn, tenantHook()],
    schema: { body: CreateWidgetSchema } as any,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthenticatedUser;
    const { id } = request.params as DashboardIdParam;
    const data = await app.dashboardService.addWidget(id, request.body as CreateWidgetDto, user.userId);
    return reply.code(201).send({ data });
  });

  app.patch(`${PREFIX}/:id/widgets/:widgetId`, {
    preHandler: [app.authHookFn, tenantHook()],
    schema: { body: UpdateWidgetSchema } as any,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthenticatedUser;
    const { id, widgetId } = request.params as WidgetIdParam;
    const data = await app.dashboardService.updateWidget(id, widgetId, request.body as UpdateWidgetDto, user.userId);
    return reply.code(200).send({ data });
  });

  app.post(`${PREFIX}/:id/widgets/batch`, {
    preHandler: [app.authHookFn, tenantHook()],
    schema: { body: BatchUpdateWidgetsSchema } as any,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthenticatedUser;
    const { id } = request.params as DashboardIdParam;
    const data = await app.dashboardService.batchUpdateWidgets(id, request.body as BatchUpdateWidgetsDto, user.userId);
    return reply.code(200).send({ data });
  });

  app.delete(`${PREFIX}/:id/widgets/:widgetId`, {
    preHandler: [app.authHookFn, tenantHook()],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthenticatedUser;
    const { id, widgetId } = request.params as WidgetIdParam;
    await app.dashboardService.removeWidget(id, widgetId, user.userId);
    return reply.code(204).send();
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  Layout (sections + widget positions — bulk save)
  // ═══════════════════════════════════════════════════════════════════════

  app.post(`${PREFIX}/:id/layout`, {
    preHandler: [app.authHookFn, tenantHook()],
    schema: { body: SaveLayoutSchema } as any,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthenticatedUser;
    const { id } = request.params as DashboardIdParam;
    const data = await app.dashboardService.saveLayout(id, request.body as SaveLayoutDto, user.userId);
    return reply.code(200).send({ data });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  Shares
  // ═══════════════════════════════════════════════════════════════════════

  // GET /dashboards/:id/shares — list active shares
  app.get(`${PREFIX}/:id/shares`, {
    preHandler: [app.authHookFn, tenantHook()],
    schema: { querystring: ListSharesQuerySchema } as any,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthenticatedUser;
    const { id } = request.params as DashboardIdParam;
    const query = request.query as ListSharesQuery;
    const data = await app.dashboardService.listShares(id, user.userId, query.page, query.limit);
    return reply.send(data);
  });

  // PATCH /dashboards/:id/share/:shareId — update share
  app.patch(`${PREFIX}/:id/share/:shareId`, {
    preHandler: [app.authHookFn, tenantHook()],
    schema: { body: UpdateShareSchema } as any,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthenticatedUser;
    const { id, shareId } = request.params as ShareIdParam;
    const data = await app.dashboardService.updateShare(id, shareId, request.body as UpdateShareDto, user.userId);
    return reply.send({ data });
  });

  app.post(`${PREFIX}/:id/share`, {
    preHandler: [app.authHookFn, tenantHook()],
    schema: { body: CreateShareSchema } as any,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthenticatedUser;
    const { id } = request.params as DashboardIdParam;
    const data = await app.dashboardService.share(id, request.body as CreateShareDto, user.userId);
    return reply.code(201).send({ data });
  });

  app.delete(`${PREFIX}/:id/share/:shareId`, {
    preHandler: [app.authHookFn, tenantHook()],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthenticatedUser;
    const { id, shareId } = request.params as ShareIdParam;
    await app.dashboardService.removeShare(id, shareId, user.userId);
    return reply.code(204).send();
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  Preferences
  // ═══════════════════════════════════════════════════════════════════════

  app.post(`${PREFIX}/preferences`, {
    preHandler: [app.authHookFn, tenantHook()],
    schema: { body: SetPreferenceSchema } as any,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthenticatedUser;
    const data = await app.dashboardService.setPreference(user.userId, request.body as SetPreferenceDto);
    return reply.code(200).send({ data });
  });
}

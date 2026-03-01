import type { FastifyInstance } from 'fastify';
import { rolesHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';

export async function registerBiRoutes(app: FastifyInstance): Promise<void> {
  const auth = [app.authHookFn];
  const adminOnly = [...auth, rolesHook(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN)];

  // ───────────────────── Tool Configs (read by all authenticated) ─────────────────────

  // GET /api/v1/bi/tools — list all BI tool configs
  app.get('/api/v1/bi/tools', {
    preHandler: auth,
  }, async () => {
    return app.biService.listTools();
  });

  // GET /api/v1/bi/tools/:tool — get a single BI tool config
  app.get<{ Params: { tool: string } }>('/api/v1/bi/tools/:tool', {
    preHandler: auth,
  }, async (request) => {
    return app.biService.getToolByName(request.params.tool);
  });

  // GET /api/v1/bi/tools/:tool/embed-url — get embed URL for a BI tool
  app.get<{ Params: { tool: string } }>('/api/v1/bi/tools/:tool/embed-url', {
    preHandler: auth,
  }, async (request) => {
    return app.biService.getToolEmbedUrl(request.params.tool);
  });

  // ───────────────────── Access Rules (admin only for write, auth for read) ─────────────────────

  // GET /api/v1/bi/access-rules — list all access rules (optionally filtered by tool)
  app.get<{ Querystring: { tool?: string } }>('/api/v1/bi/access-rules', {
    preHandler: adminOnly,
  }, async (request) => {
    return app.biService.listAccessRules(request.query.tool);
  });

  // GET /api/v1/bi/access-rules/role/:role — get access rules for a specific role
  app.get<{ Params: { role: string }; Querystring: { tool?: string } }>('/api/v1/bi/access-rules/role/:role', {
    preHandler: auth,
  }, async (request) => {
    return app.biService.getAccessRulesForRole(request.params.role, request.query.tool);
  });

  // PUT /api/v1/bi/access-rules — upsert an access rule (admin only)
  app.put<{
    Body: {
      biToolConfigId: string;
      roleLevel: string;
      allowedSchemas: string[];
      allowedTables: string[];
      excludedTables: string[];
      canCreateDashboard: boolean;
      canExportData: boolean;
      canUseSqlLab: boolean;
      dataFilters?: Record<string, unknown>;
    };
  }>('/api/v1/bi/access-rules', {
    preHandler: adminOnly,
  }, async (request) => {
    return app.biService.upsertAccessRule(request.body);
  });

  // DELETE /api/v1/bi/access-rules/:id — delete an access rule (admin only)
  app.delete<{ Params: { id: string } }>('/api/v1/bi/access-rules/:id', {
    preHandler: [...auth, rolesHook(UserRole.SUPER_ADMIN)],
  }, async (request) => {
    return app.biService.deleteAccessRule(request.params.id);
  });

  // ───────────────────── Dashboards ─────────────────────

  // GET /api/v1/bi/dashboards — list registered BI dashboards
  app.get<{ Querystring: { tool?: string } }>('/api/v1/bi/dashboards', {
    preHandler: auth,
  }, async (request) => {
    return app.biService.listDashboards(request.query.tool);
  });

  // POST /api/v1/bi/dashboards — register a dashboard (admin only)
  app.post<{
    Body: {
      biToolConfigId: string;
      externalId: string;
      name: Record<string, string>;
      description?: Record<string, string>;
      thumbnail?: string;
      category?: string;
      embedUrl: string;
      scope?: string;
      allowedRoles?: string[];
      sortOrder?: number;
      isFeatured?: boolean;
    };
  }>('/api/v1/bi/dashboards', {
    preHandler: adminOnly,
  }, async (request, reply) => {
    const result = await app.biService.createDashboard(request.body);
    return reply.code(201).send(result);
  });

  // DELETE /api/v1/bi/dashboards/:id — unregister a dashboard (admin only)
  app.delete<{ Params: { id: string } }>('/api/v1/bi/dashboards/:id', {
    preHandler: [...auth, rolesHook(UserRole.SUPER_ADMIN)],
  }, async (request) => {
    return app.biService.deleteDashboard(request.params.id);
  });
}

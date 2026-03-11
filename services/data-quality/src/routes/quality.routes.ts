import type { FastifyInstance } from 'fastify';
import { rolesHook } from '@aris/auth-middleware';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

export async function registerQualityRoutes(app: FastifyInstance): Promise<void> {
  // -----------------------------------------------------------------------
  // Validate
  // -----------------------------------------------------------------------

  // POST /api/v1/data-quality/validate -- validate a record
  app.post('/api/v1/data-quality/validate', {
    preHandler: [app.authHookFn],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    const dto = request.body as any;
    return app.validateService.validate(dto, user);
  });

  // -----------------------------------------------------------------------
  // Reports
  // -----------------------------------------------------------------------

  // GET /api/v1/data-quality/reports -- list reports
  app.get('/api/v1/data-quality/reports', {
    preHandler: [app.authHookFn],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    const query = request.query as {
      page?: number;
      limit?: number;
      sort?: string;
      order?: 'asc' | 'desc';
      domain?: string;
      status?: string;
      recordId?: string;
    };
    return app.reportService.findAll(user, {
      page: query.page ? Number(query.page) : undefined,
      limit: query.limit ? Number(query.limit) : undefined,
      sort: query.sort,
      order: query.order,
      domain: query.domain,
      status: query.status,
      recordId: query.recordId,
    });
  });

  // GET /api/v1/data-quality/reports/:id -- get report
  app.get<{ Params: { id: string } }>('/api/v1/data-quality/reports/:id', {
    preHandler: [app.authHookFn],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.reportService.findOne(request.params.id, user);
  });

  // -----------------------------------------------------------------------
  // Rules
  // -----------------------------------------------------------------------

  // POST /api/v1/data-quality/rules -- create rule (restricted roles)
  app.post('/api/v1/data-quality/rules', {
    preHandler: [
      app.authHookFn,
      rolesHook(
        UserRole.SUPER_ADMIN,
        UserRole.CONTINENTAL_ADMIN,
        UserRole.DATA_STEWARD,
      ),
    ],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    const dto = request.body as any;
    return app.ruleService.create(dto, user);
  });

  // GET /api/v1/data-quality/rules -- list rules
  app.get('/api/v1/data-quality/rules', {
    preHandler: [app.authHookFn],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    const query = request.query as {
      page?: number;
      limit?: number;
      domain?: string;
      entityType?: string;
    };
    return app.ruleService.findAll(user, {
      page: query.page ? Number(query.page) : undefined,
      limit: query.limit ? Number(query.limit) : undefined,
      domain: query.domain,
      entityType: query.entityType,
    });
  });

  // GET /api/v1/data-quality/rules/:id -- get rule
  app.get<{ Params: { id: string } }>('/api/v1/data-quality/rules/:id', {
    preHandler: [app.authHookFn],
  }, async (request) => {
    return app.ruleService.findOne(request.params.id);
  });

  // PATCH /api/v1/data-quality/rules/:id -- update rule (restricted roles)
  app.patch<{ Params: { id: string } }>('/api/v1/data-quality/rules/:id', {
    preHandler: [
      app.authHookFn,
      rolesHook(
        UserRole.SUPER_ADMIN,
        UserRole.CONTINENTAL_ADMIN,
        UserRole.DATA_STEWARD,
      ),
    ],
  }, async (request) => {
    const dto = request.body as any;
    return app.ruleService.update(request.params.id, dto);
  });

  // -----------------------------------------------------------------------
  // Corrections
  // -----------------------------------------------------------------------

  // GET /api/v1/data-quality/corrections -- list corrections
  app.get('/api/v1/data-quality/corrections', {
    preHandler: [app.authHookFn],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    const query = request.query as {
      page?: number;
      limit?: number;
      status?: string;
    };
    return app.correctionService.findAll(user, {
      page: query.page ? Number(query.page) : undefined,
      limit: query.limit ? Number(query.limit) : undefined,
      status: query.status,
    });
  });

  // GET /api/v1/data-quality/corrections/:reportId -- get correction by report ID
  app.get<{ Params: { reportId: string } }>('/api/v1/data-quality/corrections/:reportId', {
    preHandler: [app.authHookFn],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.correctionService.findByReportId(request.params.reportId, user);
  });

  // PATCH /api/v1/data-quality/corrections/:reportId/corrected -- mark corrected
  app.patch<{ Params: { reportId: string } }>('/api/v1/data-quality/corrections/:reportId/corrected', {
    preHandler: [
      app.authHookFn,
      rolesHook(
        UserRole.SUPER_ADMIN,
        UserRole.CONTINENTAL_ADMIN,
        UserRole.DATA_STEWARD,
      ),
    ],
  }, async (request) => {
    return app.correctionService.markCorrected(request.params.reportId);
  });

  // PATCH /api/v1/data-quality/corrections/:reportId/assign -- assign correction
  app.patch<{ Params: { reportId: string } }>('/api/v1/data-quality/corrections/:reportId/assign', {
    preHandler: [
      app.authHookFn,
      rolesHook(
        UserRole.SUPER_ADMIN,
        UserRole.CONTINENTAL_ADMIN,
        UserRole.DATA_STEWARD,
        UserRole.NATIONAL_ADMIN,
      ),
    ],
  }, async (request) => {
    const body = request.body as { assignedTo: string };
    return app.correctionService.assign(request.params.reportId, body.assignedTo);
  });

  // -----------------------------------------------------------------------
  // Dashboard
  // -----------------------------------------------------------------------

  // GET /api/v1/data-quality/dashboard -- get KPIs
  app.get('/api/v1/data-quality/dashboard', {
    preHandler: [app.authHookFn],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    const query = request.query as {
      domain?: string;
      from?: string;
      to?: string;
    };
    return app.dashboardService.getKpis(user, {
      domain: query.domain,
      from: query.from,
      to: query.to,
    });
  });
}

/**
 * report.routes.ts — REST routes for report service within analytics.
 *
 * Routes:
 *   GET    /report-templates                          — list templates
 *   GET    /report-templates/:id                      — get template by id
 *   POST   /admin/report-templates                    — create template (admin)
 *   PATCH  /admin/report-templates/:id                — update template
 *   DELETE /admin/report-templates/:id                — delete template
 *
 *   GET    /reports                                   — list reports
 *   GET    /reports/:id                               — get report with sections
 *   POST   /reports/generate                          — generate a new report
 *   GET    /reports/:id/status                        — generation status
 *   POST   /reports/:id/sections/:code/edit           — edit section content
 *   POST   /reports/:id/sections/:code/regenerate     — regenerate single section
 *   POST   /reports/:id/approve                       — approve report
 *   POST   /reports/:id/publish                       — publish report
 *
 *   GET    /flash-alerts                              — list alerts
 *   GET    /flash-alerts/:id                          — get alert
 *   POST   /flash-alerts/:id/dismiss                  — dismiss alert
 *
 *   GET    /flash-strategies                          — list strategies
 *   POST   /admin/flash-strategies                    — create strategy (admin)
 *   PATCH  /admin/flash-strategies/:id                — update strategy
 *   DELETE /admin/flash-strategies/:id                — delete strategy
 *
 *   GET    /ollama/health                             — Ollama health check
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { tenantHook, rolesHook } from '@aris/auth-middleware/fastify';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { UserRole } from '@aris/shared-types';
import {
  CreateReportTemplateSchema,
  UpdateReportTemplateSchema,
  GenerateReportBodySchema,
  ListReportsQuerySchema,
  EditSectionBodySchema,
  CreateFlashStrategySchema,
  UpdateFlashStrategySchema,
} from './report.schemas';
import type {
  CreateReportTemplateDto,
  UpdateReportTemplateDto,
  GenerateReportBody,
  ListReportsQuery,
  EditSectionBody,
  CreateFlashStrategyDto,
  UpdateFlashStrategyDto,
} from './report.schemas';
import { OllamaClient } from './ollama.client';

const ADMIN_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.CONTINENTAL_ADMIN,
];

const REPORT_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.CONTINENTAL_ADMIN,
  UserRole.REC_ADMIN,
  UserRole.NATIONAL_ADMIN,
  UserRole.ANALYST,
];

export async function registerReportRoutes(app: FastifyInstance): Promise<void> {
  const PREFIX = '/api/v1/analytics';

  // ═══════════════════════════════════════════════════════════════════════
  //  Report Templates
  // ═══════════════════════════════════════════════════════════════════════

  app.get(`${PREFIX}/report-templates`, {
    preHandler: [app.authHookFn, tenantHook()],
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const data = await app.reportService.listTemplates();
    return reply.code(200).send({ data });
  });

  app.get(`${PREFIX}/report-templates/:id`, {
    preHandler: [app.authHookFn, tenantHook()],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const data = await app.reportService.getTemplateById(params.id);
    if (!data) return reply.code(404).send({ statusCode: 404, message: 'Template not found' });
    return reply.code(200).send({ data });
  });

  app.post(`${PREFIX}/admin/report-templates`, {
    preHandler: [app.authHookFn, tenantHook(), rolesHook(...ADMIN_ROLES)],
    schema: { body: CreateReportTemplateSchema } as any,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as CreateReportTemplateDto;
    const user = (request as any).user as AuthenticatedUser;
    const data = await app.reportService.createTemplate(body, user.userId);
    return reply.code(201).send({ data });
  });

  app.patch(`${PREFIX}/admin/report-templates/:id`, {
    preHandler: [app.authHookFn, tenantHook(), rolesHook(...ADMIN_ROLES)],
    schema: { body: UpdateReportTemplateSchema } as any,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const body = request.body as UpdateReportTemplateDto;
    const data = await app.reportService.updateTemplate(params.id, body);
    if (!data) return reply.code(404).send({ statusCode: 404, message: 'Template not found' });
    return reply.code(200).send({ data });
  });

  app.delete(`${PREFIX}/admin/report-templates/:id`, {
    preHandler: [app.authHookFn, tenantHook(), rolesHook(...ADMIN_ROLES)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const ok = await app.reportService.deleteTemplate(params.id);
    if (!ok) return reply.code(404).send({ statusCode: 404, message: 'Template not found' });
    return reply.code(204).send();
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  Reports
  // ═══════════════════════════════════════════════════════════════════════

  app.get(`${PREFIX}/reports`, {
    preHandler: [app.authHookFn, tenantHook()],
    schema: { querystring: ListReportsQuerySchema } as any,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as ListReportsQuery;
    const user = (request as any).user as AuthenticatedUser;
    const result = await app.reportService.listReports(query, user.tenantId);
    return reply.code(200).send(result);
  });

  app.get(`${PREFIX}/reports/:id`, {
    preHandler: [app.authHookFn, tenantHook()],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const data = await app.reportService.getReportById(params.id);
    if (!data) return reply.code(404).send({ statusCode: 404, message: 'Report not found' });
    return reply.code(200).send({ data });
  });

  app.post(`${PREFIX}/reports/generate`, {
    preHandler: [app.authHookFn, tenantHook(), rolesHook(...REPORT_ROLES)],
    schema: { body: GenerateReportBodySchema } as any,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as GenerateReportBody;
    const user = (request as any).user as AuthenticatedUser;
    const data = await app.reportService.generateReport(body, user.userId, user.tenantId);
    return reply.code(201).send({ data });
  });

  app.get(`${PREFIX}/reports/:id/status`, {
    preHandler: [app.authHookFn, tenantHook()],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const data = await app.reportService.getReportStatus(params.id);
    if (!data) return reply.code(404).send({ statusCode: 404, message: 'Report not found' });
    return reply.code(200).send({ data });
  });

  app.post(`${PREFIX}/reports/:id/sections/:code/edit`, {
    preHandler: [app.authHookFn, tenantHook(), rolesHook(...REPORT_ROLES)],
    schema: { body: EditSectionBodySchema } as any,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string; code: string };
    const body = request.body as EditSectionBody;
    const data = await app.reportService.editSection(params.id, params.code, body);
    if (!data) return reply.code(404).send({ statusCode: 404, message: 'Section not found' });
    return reply.code(200).send({ data });
  });

  app.post(`${PREFIX}/reports/:id/sections/:code/regenerate`, {
    preHandler: [app.authHookFn, tenantHook(), rolesHook(...REPORT_ROLES)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string; code: string };
    const data = await app.reportService.regenerateSection(params.id, params.code);
    return reply.code(200).send({ data });
  });

  app.post(`${PREFIX}/reports/:id/approve`, {
    preHandler: [app.authHookFn, tenantHook(), rolesHook(...ADMIN_ROLES)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const user = (request as any).user as AuthenticatedUser;
    const data = await app.reportService.approveReport(params.id, user.userId);
    if (!data) return reply.code(404).send({ statusCode: 404, message: 'Report not found or not in correct status' });
    return reply.code(200).send({ data });
  });

  app.post(`${PREFIX}/reports/:id/publish`, {
    preHandler: [app.authHookFn, tenantHook(), rolesHook(...ADMIN_ROLES)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const user = (request as any).user as AuthenticatedUser;
    const data = await app.reportService.publishReport(params.id, user.userId);
    if (!data) return reply.code(404).send({ statusCode: 404, message: 'Report not found or not ready for publishing' });
    return reply.code(200).send({ data });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  Flash Alerts
  // ═══════════════════════════════════════════════════════════════════════

  app.get(`${PREFIX}/flash-alerts`, {
    preHandler: [app.authHookFn, tenantHook()],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthenticatedUser;
    const data = await app.reportService.listFlashAlerts(user.tenantId);
    return reply.code(200).send({ data });
  });

  app.get(`${PREFIX}/flash-alerts/:id`, {
    preHandler: [app.authHookFn, tenantHook()],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const data = await app.reportService.getFlashAlertById(params.id);
    if (!data) return reply.code(404).send({ statusCode: 404, message: 'Flash alert not found' });
    return reply.code(200).send({ data });
  });

  app.post(`${PREFIX}/flash-alerts/:id/dismiss`, {
    preHandler: [app.authHookFn, tenantHook()],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const user = (request as any).user as AuthenticatedUser;
    const data = await app.reportService.dismissFlashAlert(params.id, user.userId);
    if (!data) return reply.code(404).send({ statusCode: 404, message: 'Flash alert not found' });
    return reply.code(200).send({ data });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  Flash Strategies
  // ═══════════════════════════════════════════════════════════════════════

  app.get(`${PREFIX}/flash-strategies`, {
    preHandler: [app.authHookFn, tenantHook()],
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const data = await app.reportService.listFlashStrategies();
    return reply.code(200).send({ data });
  });

  app.post(`${PREFIX}/admin/flash-strategies`, {
    preHandler: [app.authHookFn, tenantHook(), rolesHook(...ADMIN_ROLES)],
    schema: { body: CreateFlashStrategySchema } as any,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as CreateFlashStrategyDto;
    const user = (request as any).user as AuthenticatedUser;
    const data = await app.reportService.createFlashStrategy(body, user.userId);
    return reply.code(201).send({ data });
  });

  app.patch(`${PREFIX}/admin/flash-strategies/:id`, {
    preHandler: [app.authHookFn, tenantHook(), rolesHook(...ADMIN_ROLES)],
    schema: { body: UpdateFlashStrategySchema } as any,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const body = request.body as UpdateFlashStrategyDto;
    const data = await app.reportService.updateFlashStrategy(params.id, body);
    if (!data) return reply.code(404).send({ statusCode: 404, message: 'Strategy not found' });
    return reply.code(200).send({ data });
  });

  app.delete(`${PREFIX}/admin/flash-strategies/:id`, {
    preHandler: [app.authHookFn, tenantHook(), rolesHook(...ADMIN_ROLES)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const ok = await app.reportService.deleteFlashStrategy(params.id);
    if (!ok) return reply.code(404).send({ statusCode: 404, message: 'Strategy not found' });
    return reply.code(204).send();
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  Ollama Health
  // ═══════════════════════════════════════════════════════════════════════

  app.get(`${PREFIX}/ollama/health`, {
    preHandler: [app.authHookFn, tenantHook()],
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const client = new OllamaClient();
    const healthy = await client.healthCheck();
    const models = healthy ? await client.listModels() : [];
    return reply.code(200).send({
      data: {
        available: healthy,
        url: client.getBaseUrl(),
        models,
      },
    });
  });
}

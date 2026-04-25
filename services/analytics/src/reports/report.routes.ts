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
    schema: { tags: ['reports'] },
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const data = await app.reportService.listTemplates();
    return reply.code(200).send({ data });
  });

  app.get(`${PREFIX}/report-templates/:id`, {
    preHandler: [app.authHookFn, tenantHook()],
    schema: { tags: ['reports'] },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const data = await app.reportService.getTemplateById(request.params.id);
    if (!data) return reply.code(404).send({ statusCode: 404, message: 'Template not found' });
    return reply.code(200).send({ data });
  });

  app.post(`${PREFIX}/admin/report-templates`, {
    preHandler: [app.authHookFn, tenantHook(), rolesHook(...ADMIN_ROLES)],
    schema: { body: CreateReportTemplateSchema, tags: ['reports'] },
  }, async (
    request: FastifyRequest<{ Body: CreateReportTemplateDto }>,
    reply: FastifyReply,
  ) => {
    const user = (request as unknown as { user: AuthenticatedUser }).user;
    const data = await app.reportService.createTemplate(request.body, user.userId);
    return reply.code(201).send({ data });
  });

  app.patch(`${PREFIX}/admin/report-templates/:id`, {
    preHandler: [app.authHookFn, tenantHook(), rolesHook(...ADMIN_ROLES)],
    schema: { body: UpdateReportTemplateSchema, tags: ['reports'] },
  }, async (
    request: FastifyRequest<{ Params: { id: string }; Body: UpdateReportTemplateDto }>,
    reply: FastifyReply,
  ) => {
    const data = await app.reportService.updateTemplate(request.params.id, request.body);
    if (!data) return reply.code(404).send({ statusCode: 404, message: 'Template not found' });
    return reply.code(200).send({ data });
  });

  app.delete(`${PREFIX}/admin/report-templates/:id`, {
    preHandler: [app.authHookFn, tenantHook(), rolesHook(...ADMIN_ROLES)],
    schema: { tags: ['reports'] },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const ok = await app.reportService.deleteTemplate(request.params.id);
    if (!ok) return reply.code(404).send({ statusCode: 404, message: 'Template not found' });
    return reply.code(204).send();
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  Reports
  // ═══════════════════════════════════════════════════════════════════════

  app.get(`${PREFIX}/reports`, {
    preHandler: [app.authHookFn, tenantHook()],
    schema: { querystring: ListReportsQuerySchema, tags: ['reports'] },
  }, async (
    request: FastifyRequest<{ Querystring: ListReportsQuery }>,
    reply: FastifyReply,
  ) => {
    const user = (request as unknown as { user: AuthenticatedUser }).user;
    const result = await app.reportService.listReports(request.query, user.tenantId);
    return reply.code(200).send(result);
  });

  app.get(`${PREFIX}/reports/:id`, {
    preHandler: [app.authHookFn, tenantHook()],
    schema: { tags: ['reports'] },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const data = await app.reportService.getReportById(request.params.id);
    if (!data) return reply.code(404).send({ statusCode: 404, message: 'Report not found' });
    return reply.code(200).send({ data });
  });

  app.post(`${PREFIX}/reports/generate`, {
    preHandler: [app.authHookFn, tenantHook(), rolesHook(...REPORT_ROLES)],
    schema: { body: GenerateReportBodySchema, tags: ['reports'] },
  }, async (
    request: FastifyRequest<{ Body: GenerateReportBody }>,
    reply: FastifyReply,
  ) => {
    const user = (request as unknown as { user: AuthenticatedUser }).user;
    const data = await app.reportService.generateReport(request.body, user.userId, user.tenantId);
    return reply.code(201).send({ data });
  });

  app.get(`${PREFIX}/reports/:id/status`, {
    preHandler: [app.authHookFn, tenantHook()],
    schema: { tags: ['reports'] },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const data = await app.reportService.getReportStatus(request.params.id);
    if (!data) return reply.code(404).send({ statusCode: 404, message: 'Report not found' });
    return reply.code(200).send({ data });
  });

  app.post(`${PREFIX}/reports/:id/sections/:code/edit`, {
    preHandler: [app.authHookFn, tenantHook(), rolesHook(...REPORT_ROLES)],
    schema: { body: EditSectionBodySchema, tags: ['reports'] },
  }, async (
    request: FastifyRequest<{ Params: { id: string; code: string }; Body: EditSectionBody }>,
    reply: FastifyReply,
  ) => {
    const data = await app.reportService.editSection(request.params.id, request.params.code, request.body);
    if (!data) return reply.code(404).send({ statusCode: 404, message: 'Section not found' });
    return reply.code(200).send({ data });
  });

  app.post(`${PREFIX}/reports/:id/sections/:code/regenerate`, {
    preHandler: [app.authHookFn, tenantHook(), rolesHook(...REPORT_ROLES)],
    schema: { tags: ['reports'] },
  }, async (
    request: FastifyRequest<{ Params: { id: string; code: string } }>,
    reply: FastifyReply,
  ) => {
    const data = await app.reportService.regenerateSection(request.params.id, request.params.code);
    return reply.code(200).send({ data });
  });

  app.post(`${PREFIX}/reports/:id/approve`, {
    preHandler: [app.authHookFn, tenantHook(), rolesHook(...ADMIN_ROLES)],
    schema: { tags: ['reports'] },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const user = (request as unknown as { user: AuthenticatedUser }).user;
    const data = await app.reportService.approveReport(request.params.id, user.userId);
    if (!data) return reply.code(404).send({ statusCode: 404, message: 'Report not found or not in correct status' });
    return reply.code(200).send({ data });
  });

  app.post(`${PREFIX}/reports/:id/publish`, {
    preHandler: [app.authHookFn, tenantHook(), rolesHook(...ADMIN_ROLES)],
    schema: { tags: ['reports'] },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const user = (request as unknown as { user: AuthenticatedUser }).user;
    const data = await app.reportService.publishReport(request.params.id, user.userId);
    if (!data) return reply.code(404).send({ statusCode: 404, message: 'Report not found or not ready for publishing' });
    return reply.code(200).send({ data });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  Flash Alerts
  // ═══════════════════════════════════════════════════════════════════════

  app.get(`${PREFIX}/flash-alerts`, {
    preHandler: [app.authHookFn, tenantHook()],
    schema: { tags: ['reports'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as unknown as { user: AuthenticatedUser }).user;
    const data = await app.reportService.listFlashAlerts(user.tenantId);
    return reply.code(200).send({ data });
  });

  app.get(`${PREFIX}/flash-alerts/:id`, {
    preHandler: [app.authHookFn, tenantHook()],
    schema: { tags: ['reports'] },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const data = await app.reportService.getFlashAlertById(request.params.id);
    if (!data) return reply.code(404).send({ statusCode: 404, message: 'Flash alert not found' });
    return reply.code(200).send({ data });
  });

  app.post(`${PREFIX}/flash-alerts/:id/dismiss`, {
    preHandler: [app.authHookFn, tenantHook()],
    schema: { tags: ['reports'] },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const user = (request as unknown as { user: AuthenticatedUser }).user;
    const data = await app.reportService.dismissFlashAlert(request.params.id, user.userId);
    if (!data) return reply.code(404).send({ statusCode: 404, message: 'Flash alert not found' });
    return reply.code(200).send({ data });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  Flash Strategies
  // ═══════════════════════════════════════════════════════════════════════

  app.get(`${PREFIX}/flash-strategies`, {
    preHandler: [app.authHookFn, tenantHook()],
    schema: { tags: ['reports'] },
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const data = await app.reportService.listFlashStrategies();
    return reply.code(200).send({ data });
  });

  app.post(`${PREFIX}/admin/flash-strategies`, {
    preHandler: [app.authHookFn, tenantHook(), rolesHook(...ADMIN_ROLES)],
    schema: { body: CreateFlashStrategySchema, tags: ['reports'] },
  }, async (
    request: FastifyRequest<{ Body: CreateFlashStrategyDto }>,
    reply: FastifyReply,
  ) => {
    const user = (request as unknown as { user: AuthenticatedUser }).user;
    const data = await app.reportService.createFlashStrategy(request.body, user.userId);
    return reply.code(201).send({ data });
  });

  app.patch(`${PREFIX}/admin/flash-strategies/:id`, {
    preHandler: [app.authHookFn, tenantHook(), rolesHook(...ADMIN_ROLES)],
    schema: { body: UpdateFlashStrategySchema, tags: ['reports'] },
  }, async (
    request: FastifyRequest<{ Params: { id: string }; Body: UpdateFlashStrategyDto }>,
    reply: FastifyReply,
  ) => {
    const data = await app.reportService.updateFlashStrategy(request.params.id, request.body);
    if (!data) return reply.code(404).send({ statusCode: 404, message: 'Strategy not found' });
    return reply.code(200).send({ data });
  });

  app.delete(`${PREFIX}/admin/flash-strategies/:id`, {
    preHandler: [app.authHookFn, tenantHook(), rolesHook(...ADMIN_ROLES)],
    schema: { tags: ['reports'] },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const ok = await app.reportService.deleteFlashStrategy(request.params.id);
    if (!ok) return reply.code(404).send({ statusCode: 404, message: 'Strategy not found' });
    return reply.code(204).send();
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  Ollama Health
  // ═══════════════════════════════════════════════════════════════════════

  app.get(`${PREFIX}/ollama/health`, {
    preHandler: [app.authHookFn, tenantHook()],
    schema: { tags: ['reports'] },
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

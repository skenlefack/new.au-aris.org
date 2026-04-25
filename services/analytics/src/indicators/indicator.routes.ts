/**
 * indicator.routes.ts — REST routes for indicator management within analytics service.
 *
 * Routes:
 *   GET  /indicator-types                      — list types
 *   POST /admin/indicator-types                — create type (admin)
 *   PATCH /admin/indicator-types/:code         — update type
 *   DELETE /admin/indicator-types/:code        — delete type (soft)
 *
 *   GET  /indicators                           — list indicators (filterable)
 *   GET  /indicators/:id                       — get by id
 *   GET  /indicators/by-code/:code             — get by code
 *   POST /admin/indicators                     — create indicator (admin)
 *   PATCH /admin/indicators/:id                — update indicator
 *   DELETE /admin/indicators/:id               — soft delete
 *
 *   GET  /indicators/:id/values                — list values
 *   GET  /indicators/:id/values/latest         — latest value
 *   POST /indicators/:id/values                — create value
 *   POST /indicators/:id/values/bulk           — bulk import
 *
 *   POST /admin/indicators/:id/formula         — set formula
 *   POST /admin/indicators/:id/formula/validate — validate formula
 *   GET  /indicators/:id/formula/evaluate      — evaluate formula
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { tenantHook, rolesHook } from '@aris/auth-middleware/fastify';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { UserRole } from '@aris/shared-types';
import {
  CreateIndicatorTypeSchema,
  UpdateIndicatorTypeSchema,
  CreateIndicatorSchema,
  UpdateIndicatorSchema,
  CreateIndicatorValueSchema,
  BulkIndicatorValueSchema,
  SetFormulaSchema,
  IndicatorListQuerySchema,
  IndicatorValueQuerySchema,
} from './indicator.schemas';
import type {
  CreateIndicatorTypeDto,
  UpdateIndicatorTypeDto,
  CreateIndicatorDto,
  UpdateIndicatorDto,
  CreateIndicatorValueDto,
  BulkIndicatorValueDto,
  SetFormulaDto,
  IndicatorListQuery,
  IndicatorValueQuery,
} from './indicator.schemas';

// Admin roles that can manage indicators
const ADMIN_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.CONTINENTAL_ADMIN,
];

export async function registerIndicatorRoutes(app: FastifyInstance): Promise<void> {
  const PREFIX = '/api/v1/analytics';

  // ═══════════════════════════════════════════════════════════════════════
  //  Indicator Types
  // ═══════════════════════════════════════════════════════════════════════

  app.get(`${PREFIX}/indicator-types`, {
    preHandler: [app.authHookFn, tenantHook()],
    schema: { tags: ['indicators'] },
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const data = await app.indicatorService.listIndicatorTypes();
    return reply.code(200).send({ data });
  });

  app.post(`${PREFIX}/admin/indicator-types`, {
    preHandler: [app.authHookFn, tenantHook(), rolesHook(...ADMIN_ROLES)],
    schema: { body: CreateIndicatorTypeSchema, tags: ['indicators'] },
  }, async (
    request: FastifyRequest<{ Body: CreateIndicatorTypeDto }>,
    reply: FastifyReply,
  ) => {
    const data = await app.indicatorService.createIndicatorType(request.body);
    return reply.code(201).send({ data });
  });

  app.patch(`${PREFIX}/admin/indicator-types/:code`, {
    preHandler: [app.authHookFn, tenantHook(), rolesHook(...ADMIN_ROLES)],
    schema: { body: UpdateIndicatorTypeSchema, tags: ['indicators'] },
  }, async (
    request: FastifyRequest<{ Params: { code: string }; Body: UpdateIndicatorTypeDto }>,
    reply: FastifyReply,
  ) => {
    const data = await app.indicatorService.updateIndicatorType(request.params.code, request.body);
    return reply.code(200).send({ data });
  });

  app.delete(`${PREFIX}/admin/indicator-types/:code`, {
    preHandler: [app.authHookFn, tenantHook(), rolesHook(...ADMIN_ROLES)],
    schema: { tags: ['indicators'] },
  }, async (
    request: FastifyRequest<{ Params: { code: string } }>,
    reply: FastifyReply,
  ) => {
    await app.indicatorService.deleteIndicatorType(request.params.code);
    return reply.code(204).send();
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  Indicators
  // ═══════════════════════════════════════════════════════════════════════

  app.get(`${PREFIX}/indicators`, {
    preHandler: [app.authHookFn, tenantHook()],
    schema: { querystring: IndicatorListQuerySchema, tags: ['indicators'] },
  }, async (
    request: FastifyRequest<{ Querystring: IndicatorListQuery }>,
    reply: FastifyReply,
  ) => {
    const result = await app.indicatorService.listIndicators(request.query);
    return reply.code(200).send(result);
  });

  app.get(`${PREFIX}/indicators/by-code/:code`, {
    preHandler: [app.authHookFn, tenantHook()],
    schema: { tags: ['indicators'] },
  }, async (
    request: FastifyRequest<{ Params: { code: string } }>,
    reply: FastifyReply,
  ) => {
    const data = await app.indicatorService.getIndicatorByCode(request.params.code);
    return reply.code(200).send({ data });
  });

  app.get(`${PREFIX}/indicators/:id`, {
    preHandler: [app.authHookFn, tenantHook()],
    schema: { tags: ['indicators'] },
  }, async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => {
    const data = await app.indicatorService.getIndicatorById(request.params.id);
    return reply.code(200).send({ data });
  });

  app.post(`${PREFIX}/admin/indicators`, {
    preHandler: [app.authHookFn, tenantHook(), rolesHook(...ADMIN_ROLES)],
    schema: { body: CreateIndicatorSchema, tags: ['indicators'] },
  }, async (
    request: FastifyRequest<{ Body: CreateIndicatorDto }>,
    reply: FastifyReply,
  ) => {
    const user = request.user as AuthenticatedUser;
    const data = await app.indicatorService.createIndicator(request.body, user.userId);
    return reply.code(201).send({ data });
  });

  app.patch(`${PREFIX}/admin/indicators/:id`, {
    preHandler: [app.authHookFn, tenantHook(), rolesHook(...ADMIN_ROLES)],
    schema: { body: UpdateIndicatorSchema, tags: ['indicators'] },
  }, async (
    request: FastifyRequest<{ Params: { id: string }; Body: UpdateIndicatorDto }>,
    reply: FastifyReply,
  ) => {
    const data = await app.indicatorService.updateIndicator(request.params.id, request.body);
    return reply.code(200).send({ data });
  });

  app.delete(`${PREFIX}/admin/indicators/:id`, {
    preHandler: [app.authHookFn, tenantHook(), rolesHook(...ADMIN_ROLES)],
    schema: { tags: ['indicators'] },
  }, async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => {
    await app.indicatorService.deleteIndicator(request.params.id);
    return reply.code(204).send();
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  Indicator Values
  // ═══════════════════════════════════════════════════════════════════════

  app.get(`${PREFIX}/indicators/:id/values`, {
    preHandler: [app.authHookFn, tenantHook()],
    schema: { querystring: IndicatorValueQuerySchema, tags: ['indicators'] },
  }, async (
    request: FastifyRequest<{ Params: { id: string }; Querystring: IndicatorValueQuery }>,
    reply: FastifyReply,
  ) => {
    const result = await app.indicatorService.listValues(request.params.id, request.query);
    return reply.code(200).send(result);
  });

  app.get(`${PREFIX}/indicators/:id/values/latest`, {
    preHandler: [app.authHookFn, tenantHook()],
    schema: { tags: ['indicators'] },
  }, async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => {
    const data = await app.indicatorService.getLatestValue(request.params.id);
    if (!data) {
      return reply.code(404).send({ statusCode: 404, message: 'No values found for this indicator' });
    }
    return reply.code(200).send({ data });
  });

  app.post(`${PREFIX}/indicators/:id/values`, {
    preHandler: [app.authHookFn, tenantHook()],
    schema: { body: CreateIndicatorValueSchema, tags: ['indicators'] },
  }, async (
    request: FastifyRequest<{ Params: { id: string }; Body: CreateIndicatorValueDto }>,
    reply: FastifyReply,
  ) => {
    const user = request.user as AuthenticatedUser;
    const data = await app.indicatorService.createValue(request.params.id, request.body, user.userId);
    return reply.code(201).send({ data });
  });

  app.post(`${PREFIX}/indicators/:id/values/bulk`, {
    preHandler: [app.authHookFn, tenantHook()],
    schema: { body: BulkIndicatorValueSchema, tags: ['indicators'] },
  }, async (
    request: FastifyRequest<{ Params: { id: string }; Body: BulkIndicatorValueDto }>,
    reply: FastifyReply,
  ) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.indicatorService.bulkCreateValues(request.params.id, request.body, user.userId);
    return reply.code(201).send({ data: result });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  Formula
  // ═══════════════════════════════════════════════════════════════════════

  app.post(`${PREFIX}/admin/indicators/:id/formula`, {
    preHandler: [app.authHookFn, tenantHook(), rolesHook(...ADMIN_ROLES)],
    schema: { body: SetFormulaSchema, tags: ['indicators'] },
  }, async (
    request: FastifyRequest<{ Params: { id: string }; Body: SetFormulaDto }>,
    reply: FastifyReply,
  ) => {
    // Validate formula before saving
    const validation = await app.formulaEvaluator.validate(
      request.params.id,
      request.body.expression,
      request.body.dependencies.map((d) => d.indicatorCode),
    );
    if (!validation.valid) {
      return reply.code(400).send({
        statusCode: 400,
        message: 'Invalid formula',
        errors: validation.errors,
      });
    }

    const data = await app.indicatorService.setFormula(request.params.id, request.body);
    return reply.code(200).send({ data });
  });

  app.post(`${PREFIX}/admin/indicators/:id/formula/validate`, {
    preHandler: [app.authHookFn, tenantHook(), rolesHook(...ADMIN_ROLES)],
    schema: { body: SetFormulaSchema, tags: ['indicators'] },
  }, async (
    request: FastifyRequest<{ Params: { id: string }; Body: SetFormulaDto }>,
    reply: FastifyReply,
  ) => {
    const result = await app.formulaEvaluator.validate(
      request.params.id,
      request.body.expression,
      request.body.dependencies.map((d) => d.indicatorCode),
    );
    return reply.code(200).send({ data: result });
  });

  app.get(`${PREFIX}/indicators/:id/formula/evaluate`, {
    preHandler: [app.authHookFn, tenantHook()],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          year: { type: 'integer' },
          countryCode: { type: 'string' },
        },
        required: ['year'],
      },
      tags: ['indicators'],
    },
  }, async (
    request: FastifyRequest<{ Params: { id: string }; Querystring: { year: number; countryCode?: string } }>,
    reply: FastifyReply,
  ) => {
    const { year, countryCode } = request.query;
    const result = await app.formulaEvaluator.evaluate(request.params.id, year, countryCode);
    return reply.code(200).send({ data: result });
  });
}

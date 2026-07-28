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
    schema: {} as any,
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const data = await app.indicatorService.listIndicatorTypes();
    return reply.code(200).send({ data });
  });

  app.post(`${PREFIX}/admin/indicator-types`, {
    preHandler: [app.authHookFn, tenantHook(), rolesHook(...ADMIN_ROLES)],
    schema: { body: CreateIndicatorTypeSchema } as any,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as CreateIndicatorTypeDto;
    const data = await app.indicatorService.createIndicatorType(body);
    return reply.code(201).send({ data });
  });

  app.patch(`${PREFIX}/admin/indicator-types/:code`, {
    preHandler: [app.authHookFn, tenantHook(), rolesHook(...ADMIN_ROLES)],
    schema: { body: UpdateIndicatorTypeSchema } as any,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { code: string };
    const body = request.body as UpdateIndicatorTypeDto;
    const data = await app.indicatorService.updateIndicatorType(params.code, body);
    return reply.code(200).send({ data });
  });

  app.delete(`${PREFIX}/admin/indicator-types/:code`, {
    preHandler: [app.authHookFn, tenantHook(), rolesHook(...ADMIN_ROLES)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { code: string };
    await app.indicatorService.deleteIndicatorType(params.code);
    return reply.code(204).send();
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  Indicators
  // ═══════════════════════════════════════════════════════════════════════

  app.get(`${PREFIX}/indicators`, {
    preHandler: [app.authHookFn, tenantHook()],
    schema: { querystring: IndicatorListQuerySchema } as any,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as IndicatorListQuery;
    const result = await app.indicatorService.listIndicators(query);
    return reply.code(200).send(result);
  });

  app.get(`${PREFIX}/indicators/by-code/:code`, {
    preHandler: [app.authHookFn, tenantHook()],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { code: string };
    const data = await app.indicatorService.getIndicatorByCode(params.code);
    return reply.code(200).send({ data });
  });

  app.get(`${PREFIX}/indicators/:id`, {
    preHandler: [app.authHookFn, tenantHook()],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const data = await app.indicatorService.getIndicatorById(params.id);
    return reply.code(200).send({ data });
  });

  app.post(`${PREFIX}/admin/indicators`, {
    preHandler: [app.authHookFn, tenantHook(), rolesHook(...ADMIN_ROLES)],
    schema: { body: CreateIndicatorSchema } as any,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as CreateIndicatorDto;
    const user = (request as any).user as AuthenticatedUser;
    const data = await app.indicatorService.createIndicator(body, user.userId);
    return reply.code(201).send({ data });
  });

  app.patch(`${PREFIX}/admin/indicators/:id`, {
    preHandler: [app.authHookFn, tenantHook(), rolesHook(...ADMIN_ROLES)],
    schema: { body: UpdateIndicatorSchema } as any,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const body = request.body as UpdateIndicatorDto;
    const data = await app.indicatorService.updateIndicator(params.id, body);
    return reply.code(200).send({ data });
  });

  app.delete(`${PREFIX}/admin/indicators/:id`, {
    preHandler: [app.authHookFn, tenantHook(), rolesHook(...ADMIN_ROLES)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    await app.indicatorService.deleteIndicator(params.id);
    return reply.code(204).send();
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  Indicator Values
  // ═══════════════════════════════════════════════════════════════════════

  app.get(`${PREFIX}/indicators/:id/values`, {
    preHandler: [app.authHookFn, tenantHook()],
    schema: { querystring: IndicatorValueQuerySchema } as any,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const query = request.query as IndicatorValueQuery;
    const result = await app.indicatorService.listValues(params.id, query);
    return reply.code(200).send(result);
  });

  app.get(`${PREFIX}/indicators/:id/values/latest`, {
    preHandler: [app.authHookFn, tenantHook()],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const data = await app.indicatorService.getLatestValue(params.id);
    if (!data) {
      return reply.code(404).send({ statusCode: 404, message: 'No values found for this indicator' });
    }
    return reply.code(200).send({ data });
  });

  app.post(`${PREFIX}/indicators/:id/values`, {
    preHandler: [app.authHookFn, tenantHook()],
    schema: { body: CreateIndicatorValueSchema } as any,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const body = request.body as CreateIndicatorValueDto;
    const user = (request as any).user as AuthenticatedUser;
    const data = await app.indicatorService.createValue(params.id, body, user.userId);
    return reply.code(201).send({ data });
  });

  app.post(`${PREFIX}/indicators/:id/values/bulk`, {
    preHandler: [app.authHookFn, tenantHook()],
    schema: { body: BulkIndicatorValueSchema } as any,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const body = request.body as BulkIndicatorValueDto;
    const user = (request as any).user as AuthenticatedUser;
    const result = await app.indicatorService.bulkCreateValues(params.id, body, user.userId);
    return reply.code(201).send({ data: result });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  Formula
  // ═══════════════════════════════════════════════════════════════════════

  app.post(`${PREFIX}/admin/indicators/:id/formula`, {
    preHandler: [app.authHookFn, tenantHook(), rolesHook(...ADMIN_ROLES)],
    schema: { body: SetFormulaSchema } as any,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const body = request.body as SetFormulaDto;

    // Validate formula before saving
    const validation = await app.formulaEvaluator.validate(
      params.id,
      body.expression,
      body.dependencies.map((d) => d.indicatorCode),
    );
    if (!validation.valid) {
      return reply.code(400).send({
        statusCode: 400,
        message: 'Invalid formula',
        errors: validation.errors,
      });
    }

    const data = await app.indicatorService.setFormula(params.id, body);
    return reply.code(200).send({ data });
  });

  app.post(`${PREFIX}/admin/indicators/:id/formula/validate`, {
    preHandler: [app.authHookFn, tenantHook(), rolesHook(...ADMIN_ROLES)],
    schema: { body: SetFormulaSchema } as any,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const body = request.body as SetFormulaDto;
    const result = await app.formulaEvaluator.validate(
      params.id,
      body.expression,
      body.dependencies.map((d) => d.indicatorCode),
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
    } as any,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const query = request.query as { year: number; countryCode?: string };
    const { year, countryCode } = query;
    const result = await app.formulaEvaluator.evaluate(params.id, year, countryCode);
    return reply.code(200).send({ data: result });
  });
}

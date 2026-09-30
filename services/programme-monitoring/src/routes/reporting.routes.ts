import type { FastifyInstance } from 'fastify';
import { rolesHook, tenantHook, domainsHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  CreateCycleSchema, UpdateCycleSchema, CreateReportSchema, ValidateReportSchema,
  type CreateCycleInput, type UpdateCycleInput,
  type CreateReportInput, type ValidateReportInput,
} from '../schemas/reporting.schema.js';
import { PaginationQuerySchema, UuidParamSchema, type PaginationQueryInput, type UuidParamInput } from '../schemas/common.schema.js';

const ADMIN_ROLES = [UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN];
const REPORT_ROLES = [
  UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN, UserRole.REC_ADMIN,
  UserRole.NATIONAL_ADMIN, UserRole.DATA_STEWARD,
];

export async function registerReportingRoutes(app: FastifyInstance): Promise<void> {
  const authAndTenant = [app.authHookFn, tenantHook(), domainsHook('programme-monitoring')];

  // ── Cycles ──

  // POST — create reporting cycle for a programme
  app.post<{ Params: UuidParamInput; Body: CreateCycleInput }>(
    '/api/v1/programme-monitoring/programmes/:id/cycles',
    {
      schema: { params: UuidParamSchema, body: CreateCycleSchema },
      preHandler: [...authAndTenant, rolesHook(...ADMIN_ROLES)],
    },
    async (request, reply) => {
      const user = request.user as AuthenticatedUser;
      return reply.code(201).send(await app.reportingService.createCycle(request.params.id, request.body, user));
    },
  );

  // GET — list cycles for a programme
  app.get<{ Params: UuidParamInput; Querystring: PaginationQueryInput }>(
    '/api/v1/programme-monitoring/programmes/:id/cycles',
    {
      schema: { params: UuidParamSchema },
      preHandler: authAndTenant,
    },
    async (request) => {
      const { page, limit } = request.query;
      return app.reportingService.findCycles(request.params.id, { page, limit });
    },
  );

  // GET — get cycle detail
  app.get<{ Params: UuidParamInput }>(
    '/api/v1/programme-monitoring/cycles/:id',
    {
      schema: { params: UuidParamSchema },
      preHandler: authAndTenant,
    },
    async (request) => {
      return app.reportingService.findCycle(request.params.id);
    },
  );

  // PATCH — update cycle (close/publish)
  app.patch<{ Params: UuidParamInput; Body: UpdateCycleInput }>(
    '/api/v1/programme-monitoring/cycles/:id',
    {
      schema: { params: UuidParamSchema, body: UpdateCycleSchema },
      preHandler: [...authAndTenant, rolesHook(...ADMIN_ROLES)],
    },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      return app.reportingService.updateCycle(request.params.id, request.body, user);
    },
  );

  // ── Reports ──

  // POST — submit activity report for a cycle
  app.post<{ Params: UuidParamInput; Body: CreateReportInput }>(
    '/api/v1/programme-monitoring/cycles/:id/reports',
    {
      schema: { params: UuidParamSchema, body: CreateReportSchema },
      preHandler: [...authAndTenant, rolesHook(...REPORT_ROLES)],
    },
    async (request, reply) => {
      const user = request.user as AuthenticatedUser;
      return reply.code(201).send(await app.reportingService.createReport(request.params.id, request.body, user));
    },
  );

  // GET — list reports for a cycle
  app.get<{ Params: UuidParamInput }>(
    '/api/v1/programme-monitoring/cycles/:id/reports',
    {
      schema: { params: UuidParamSchema },
      preHandler: authAndTenant,
    },
    async (request) => {
      return app.reportingService.findReports(request.params.id);
    },
  );

  // POST — validate/reject a report
  app.post<{ Params: UuidParamInput; Body: ValidateReportInput }>(
    '/api/v1/programme-monitoring/reports/:id/validate',
    {
      schema: { params: UuidParamSchema, body: ValidateReportSchema },
      preHandler: [...authAndTenant, rolesHook(...ADMIN_ROLES)],
    },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      return app.reportingService.validateReport(request.params.id, request.body, user);
    },
  );
}

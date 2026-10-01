import type { FastifyInstance } from 'fastify';
import { rolesHook, tenantHook, domainsHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  CreateRiskSchema, UpdateRiskSchema, TeamMemberSchema,
  type CreateRiskInput, type UpdateRiskInput, type TeamMemberInput,
} from '../schemas/risk.schema.js';
import { UuidParamSchema, type UuidParamInput } from '../schemas/common.schema.js';

const ADMIN_ROLES = [UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN];

export async function registerRiskTeamRoutes(app: FastifyInstance): Promise<void> {
  const authAndTenant = [app.authHookFn, tenantHook(), domainsHook('programme-monitoring')];

  // ── Risks ──

  app.post<{ Params: UuidParamInput; Body: CreateRiskInput }>(
    '/api/v1/programme-monitoring/programmes/:id/risks',
    {
      schema: { params: UuidParamSchema, body: CreateRiskSchema },
      preHandler: [...authAndTenant, rolesHook(...ADMIN_ROLES)],
    },
    async (request, reply) => {
      const user = request.user as AuthenticatedUser;
      return reply.code(201).send(await app.riskService.create(request.params.id, request.body, user));
    },
  );

  app.get<{ Params: UuidParamInput }>(
    '/api/v1/programme-monitoring/programmes/:id/risks',
    {
      schema: { params: UuidParamSchema },
      preHandler: authAndTenant,
    },
    async (request) => {
      return app.riskService.findAll(request.params.id);
    },
  );

  app.patch<{ Params: UuidParamInput; Body: UpdateRiskInput }>(
    '/api/v1/programme-monitoring/risks/:id',
    {
      schema: { params: UuidParamSchema, body: UpdateRiskSchema },
      preHandler: [...authAndTenant, rolesHook(...ADMIN_ROLES)],
    },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      return app.riskService.update(request.params.id, request.body, user);
    },
  );

  // GET — risk matrix (4x4 likelihood × impact)
  app.get<{ Params: UuidParamInput }>(
    '/api/v1/programme-monitoring/programmes/:id/risk-matrix',
    {
      schema: { params: UuidParamSchema },
      preHandler: authAndTenant,
    },
    async (request) => {
      return app.riskService.riskMatrix(request.params.id);
    },
  );

  // ── Team ──

  app.post<{ Params: UuidParamInput; Body: TeamMemberInput }>(
    '/api/v1/programme-monitoring/programmes/:id/team',
    {
      schema: { params: UuidParamSchema, body: TeamMemberSchema },
      preHandler: [...authAndTenant, rolesHook(...ADMIN_ROLES)],
    },
    async (request, reply) => {
      const user = request.user as AuthenticatedUser;
      return reply.code(201).send(await app.riskService.addTeamMember(request.params.id, request.body, user));
    },
  );

  app.get<{ Params: UuidParamInput }>(
    '/api/v1/programme-monitoring/programmes/:id/team',
    {
      schema: { params: UuidParamSchema },
      preHandler: authAndTenant,
    },
    async (request) => {
      return app.riskService.findTeam(request.params.id);
    },
  );

  app.patch(
    '/api/v1/programme-monitoring/programmes/:programmeId/team/:userId',
    {
      preHandler: [...authAndTenant, rolesHook(...ADMIN_ROLES)],
    },
    async (request) => {
      const { programmeId, userId } = request.params as { programmeId: string; userId: string };
      const user = request.user as AuthenticatedUser;
      return app.riskService.updateTeamMember(programmeId, userId, request.body, user);
    },
  );

  app.delete(
    '/api/v1/programme-monitoring/programmes/:programmeId/team/:userId',
    {
      preHandler: [...authAndTenant, rolesHook(...ADMIN_ROLES)],
    },
    async (request) => {
      const { programmeId, userId } = request.params as { programmeId: string; userId: string };
      return app.riskService.removeTeamMember(programmeId, userId);
    },
  );

  // ── Units ──

  app.post<{ Params: UuidParamInput }>(
    '/api/v1/programme-monitoring/programmes/:id/units',
    { preHandler: [...authAndTenant, rolesHook(...ADMIN_ROLES)] },
    async (request, reply) => {
      return reply.code(201).send(await app.riskService.createUnit(request.params.id, request.body));
    },
  );

  app.get<{ Params: UuidParamInput }>(
    '/api/v1/programme-monitoring/programmes/:id/units',
    { preHandler: authAndTenant },
    async (request) => { return app.riskService.findUnits(request.params.id); },
  );

  app.patch<{ Params: UuidParamInput }>(
    '/api/v1/programme-monitoring/units/:id',
    { preHandler: [...authAndTenant, rolesHook(...ADMIN_ROLES)] },
    async (request) => { return app.riskService.updateUnit(request.params.id, request.body); },
  );

  app.delete<{ Params: UuidParamInput }>(
    '/api/v1/programme-monitoring/units/:id',
    { schema: { params: UuidParamSchema }, preHandler: [...authAndTenant, rolesHook(...ADMIN_ROLES)] },
    async (request) => { return app.riskService.deleteUnit(request.params.id); },
  );

  // ── Role Definitions ──

  app.post<{ Params: UuidParamInput }>(
    '/api/v1/programme-monitoring/programmes/:id/roles',
    { preHandler: [...authAndTenant, rolesHook(...ADMIN_ROLES)] },
    async (request, reply) => {
      return reply.code(201).send(await app.riskService.createRoleDef(request.params.id, request.body));
    },
  );

  app.get<{ Params: UuidParamInput }>(
    '/api/v1/programme-monitoring/programmes/:id/roles',
    { preHandler: authAndTenant },
    async (request) => { return app.riskService.findRoleDefs(request.params.id); },
  );

  app.delete<{ Params: UuidParamInput }>(
    '/api/v1/programme-monitoring/roles/:id',
    { schema: { params: UuidParamSchema }, preHandler: [...authAndTenant, rolesHook(...ADMIN_ROLES)] },
    async (request) => { return app.riskService.deleteRoleDef(request.params.id); },
  );
}

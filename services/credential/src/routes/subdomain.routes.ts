import type { FastifyInstance } from 'fastify';
import { rolesHook, tenantHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  CreateSubDomainSchema, UpdateSubDomainSchema,
  SubDomainIdParamSchema, DomainCodeParamSchema, ValueChainCodeParamSchema,
  SubDomainListQuerySchema,
  type CreateSubDomainInput, type UpdateSubDomainInput,
  type SubDomainIdParam, type DomainCodeParam, type ValueChainCodeParam,
  type SubDomainListQuery,
} from '../schemas/subdomain.schemas.js';

const ADMIN_ROLES = [UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN, UserRole.REC_ADMIN, UserRole.NATIONAL_ADMIN];

export async function registerSubDomainRoutes(app: FastifyInstance): Promise<void> {
  const auth = [app.authHookFn];
  const authTenant = [app.authHookFn, tenantHook()];
  const admin = [...authTenant, rolesHook(...ADMIN_ROLES)];

  // ═══════════════════════════════════════════════════════
  //  ADMIN CRUD
  // ═══════════════════════════════════════════════════════

  // POST /api/v1/credential/admin/sub-domains
  app.post<{ Body: CreateSubDomainInput }>(
    '/api/v1/credential/admin/sub-domains',
    { schema: { body: CreateSubDomainSchema }, preHandler: admin },
    async (request, reply) => {
      const caller = request.user as AuthenticatedUser;
      const result = await app.subDomainService.create(request.body, caller.userId, caller.tenantId);
      return reply.code(201).send(result);
    },
  );

  // PATCH /api/v1/credential/admin/sub-domains/:id
  app.patch<{ Params: SubDomainIdParam; Body: UpdateSubDomainInput }>(
    '/api/v1/credential/admin/sub-domains/:id',
    { schema: { params: SubDomainIdParamSchema, body: UpdateSubDomainSchema }, preHandler: admin },
    async (request) => {
      const caller = request.user as AuthenticatedUser;
      return app.subDomainService.update(request.params.id, request.body, caller.userId, caller.tenantId);
    },
  );

  // DELETE /api/v1/credential/admin/sub-domains/:id
  app.delete<{ Params: SubDomainIdParam }>(
    '/api/v1/credential/admin/sub-domains/:id',
    { schema: { params: SubDomainIdParamSchema }, preHandler: admin },
    async (request) => {
      const caller = request.user as AuthenticatedUser;
      return app.subDomainService.delete(request.params.id, caller.userId, caller.tenantId);
    },
  );

  // GET /api/v1/credential/admin/sub-domains/:id
  app.get<{ Params: SubDomainIdParam }>(
    '/api/v1/credential/admin/sub-domains/:id',
    { schema: { params: SubDomainIdParamSchema }, preHandler: admin },
    async (request) => {
      return app.subDomainService.getById(request.params.id);
    },
  );

  // GET /api/v1/credential/admin/sub-domains (paginated + filters)
  app.get<{ Querystring: SubDomainListQuery }>(
    '/api/v1/credential/admin/sub-domains',
    { schema: { querystring: SubDomainListQuerySchema }, preHandler: admin },
    async (request) => {
      return app.subDomainService.list(request.query);
    },
  );

  // ═══════════════════════════════════════════════════════
  //  CONSULTATION (authenticated users)
  // ═══════════════════════════════════════════════════════

  // GET /api/v1/credential/domains/:code/sub-domains
  app.get<{ Params: DomainCodeParam }>(
    '/api/v1/credential/domains/:code/sub-domains',
    { schema: { params: DomainCodeParamSchema }, preHandler: auth },
    async (request) => {
      return app.subDomainService.listByDomain(request.params.code);
    },
  );

  // GET /api/v1/credential/value-chain-codes (list all)
  app.get(
    '/api/v1/credential/value-chain-codes',
    { preHandler: auth },
    async () => {
      return app.subDomainService.listAllValueChainCodes();
    },
  );

  // GET /api/v1/credential/value-chain-codes/:code/sub-domains (transverse)
  app.get<{ Params: ValueChainCodeParam }>(
    '/api/v1/credential/value-chain-codes/:code/sub-domains',
    { schema: { params: ValueChainCodeParamSchema }, preHandler: auth },
    async (request) => {
      return app.subDomainService.listByValueChainCode(request.params.code);
    },
  );

  // GET /api/v1/credential/me/access
  app.get(
    '/api/v1/credential/me/access',
    { preHandler: auth },
    async (request) => {
      const caller = request.user as AuthenticatedUser;
      return app.permissionResolver.resolveUserAccess(caller.userId);
    },
  );
}

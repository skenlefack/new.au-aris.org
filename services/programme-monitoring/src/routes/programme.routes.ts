import type { FastifyInstance } from 'fastify';
import { rolesHook, tenantHook, domainsHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  CreateProgrammeSchema, UpdateProgrammeSchema, ProgrammeFilterSchema,
  type CreateProgrammeInput, type UpdateProgrammeInput, type ProgrammeFilterInput,
} from '../schemas/programme.schema.js';
import { PaginationQuerySchema, UuidParamSchema, type PaginationQueryInput, type UuidParamInput } from '../schemas/common.schema.js';

const PREFIX = '/api/v1/programme-monitoring/programmes';

const WRITE_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.CONTINENTAL_ADMIN,
];

const READ_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.CONTINENTAL_ADMIN,
  UserRole.REC_ADMIN,
  UserRole.NATIONAL_ADMIN,
  UserRole.DATA_STEWARD,
  UserRole.ANALYST,
];

export async function registerProgrammeRoutes(app: FastifyInstance): Promise<void> {
  const authAndTenant = [app.authHookFn, tenantHook(), domainsHook('programme-monitoring')];

  // POST — create programme (with optional nested components/outputs)
  app.post<{ Body: CreateProgrammeInput }>(PREFIX, {
    schema: { body: CreateProgrammeSchema },
    preHandler: [...authAndTenant, rolesHook(...WRITE_ROLES)],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.programmeService.create(request.body, user);
    return reply.code(201).send(result);
  });

  // GET — list programmes
  app.get<{ Querystring: PaginationQueryInput & ProgrammeFilterInput }>(PREFIX, {
    schema: {
      querystring: {
        ...PaginationQuerySchema,
        ...ProgrammeFilterSchema,
        type: 'object' as const,
        properties: { ...PaginationQuerySchema.properties, ...ProgrammeFilterSchema.properties },
      },
    },
    preHandler: [...authAndTenant, rolesHook(...READ_ROLES)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    const { page, limit, sort, order, ...filter } = request.query;
    return app.programmeService.findAll(user, { page, limit, sort, order }, filter);
  });

  // GET — get programme by ID (full detail with components/outputs/activities)
  app.get<{ Params: UuidParamInput }>(`${PREFIX}/:id`, {
    schema: { params: UuidParamSchema },
    preHandler: [...authAndTenant, rolesHook(...READ_ROLES)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.programmeService.findOne(request.params.id, user);
  });

  // PATCH — update programme
  app.patch<{ Params: UuidParamInput; Body: UpdateProgrammeInput }>(`${PREFIX}/:id`, {
    schema: { params: UuidParamSchema, body: UpdateProgrammeSchema },
    preHandler: [...authAndTenant, rolesHook(...WRITE_ROLES)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.programmeService.update(request.params.id, request.body, user);
  });
}

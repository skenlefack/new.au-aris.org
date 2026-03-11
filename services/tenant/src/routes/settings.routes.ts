import type { FastifyInstance } from 'fastify';
import { rolesHook, tenantHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  RecCodeParamSchema,
  RecBodySchema,
  RecSortBodySchema,
  RecStatsBodySchema,
  UuidParamSchema,
  IdOrCodeParamSchema,
  CountryCodeParamSchema,
  CountryBodySchema,
  CountryStatsBodySchema,
  CountrySectorsBodySchema,
  CountryRecParamsSchema,
  ConfigCategoryParamSchema,
  ConfigKeyParamSchema,
  ConfigUpdateBodySchema,
  ConfigBulkBodySchema,
  DomainBodySchema,
  DomainSortBodySchema,
  SearchQuerySchema,
  AdminLevelsBulkBodySchema,
  AdminLevelParamSchema,
  FunctionBodySchema,
  FunctionUpdateBodySchema,
  FunctionQuerySchema,
  UserFunctionAssignBodySchema,
  UserFunctionRemoveParamsSchema,
  UserManagementQuerySchema,
  UserCreateBodySchema,
  UserUpdateBodySchema,
  UserPasswordBodySchema,
  type RecCodeParamInput,
  type RecBodyInput,
  type RecSortBodyInput,
  type RecStatsBodyInput,
  type UuidParamInput,
  type IdOrCodeParamInput,
  type CountryCodeParamInput,
  type CountryBodyInput,
  type CountryStatsBodyInput,
  type CountrySectorsBodyInput,
  type CountryRecParamsInput,
  type ConfigCategoryParamInput,
  type ConfigKeyParamInput,
  type ConfigUpdateBodyInput,
  type ConfigBulkBodyInput,
  type DomainBodyInput,
  type DomainSortBodyInput,
  type SearchQueryInput,
  type AdminLevelsBulkBodyInput,
  type AdminLevelParamInput,
  type FunctionBodyInput,
  type FunctionUpdateBodyInput,
  type FunctionQueryInput,
  type UserFunctionAssignBodyInput,
  type UserFunctionRemoveParamsInput,
  type UserManagementQueryInput,
  type UserCreateBodyInput,
  type UserUpdateBodyInput,
  type UserPasswordBodyInput,
} from '../schemas/settings.schemas.js';

export async function registerSettingsRoutes(app: FastifyInstance): Promise<void> {
  const authAndTenant = [app.authHookFn, tenantHook()];

  // ───────────────────── RECs ─────────────────────

  // GET /api/v1/settings/scope — returns the user's resolved scope
  app.get('/api/v1/settings/scope', {
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    const scope = await app.settingsService.getUserScope(user);
    return { data: scope };
  });

  // GET /api/v1/settings/recs — list all RECs (filtered by user scope)
  app.get<{ Querystring: SearchQueryInput }>('/api/v1/settings/recs', {
    schema: { querystring: SearchQuerySchema },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.settingsService.listRecs(request.query, user);
  });

  // GET /api/v1/settings/recs/:idOrCode — get REC by UUID or code (scope-checked)
  app.get<{ Params: IdOrCodeParamInput }>('/api/v1/settings/recs/:idOrCode', {
    schema: { params: IdOrCodeParamSchema },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.settingsService.getRecByIdOrCode(request.params.idOrCode, user);
  });

  // POST /api/v1/settings/recs — create REC (SUPER_ADMIN)
  app.post<{ Body: RecBodyInput }>('/api/v1/settings/recs', {
    schema: { body: RecBodySchema },
    preHandler: [...authAndTenant, rolesHook(UserRole.SUPER_ADMIN)],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.settingsService.createRec(request.body as Record<string, unknown>, user);
    return reply.code(201).send(result);
  });

  // PUT /api/v1/settings/recs/:id — update REC (SUPER_ADMIN, CONTINENTAL_ADMIN)
  app.put<{ Params: UuidParamInput; Body: RecBodyInput }>('/api/v1/settings/recs/:id', {
    schema: { params: UuidParamSchema, body: RecBodySchema },
    preHandler: [...authAndTenant, rolesHook(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.settingsService.updateRec(request.params.id, request.body as Record<string, unknown>, user);
  });

  // DELETE /api/v1/settings/recs/:id — delete REC (SUPER_ADMIN)
  app.delete<{ Params: UuidParamInput }>('/api/v1/settings/recs/:id', {
    schema: { params: UuidParamSchema },
    preHandler: [...authAndTenant, rolesHook(UserRole.SUPER_ADMIN)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.settingsService.deleteRec(request.params.id, user);
  });

  // PATCH /api/v1/settings/recs/:id/sort — update REC sort order (SUPER_ADMIN)
  app.patch<{ Params: UuidParamInput; Body: RecSortBodyInput }>('/api/v1/settings/recs/:id/sort', {
    schema: { params: UuidParamSchema, body: RecSortBodySchema },
    preHandler: [...authAndTenant, rolesHook(UserRole.SUPER_ADMIN)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.settingsService.updateRecSort(request.params.id, request.body.sortOrder, user);
  });

  // PATCH /api/v1/settings/recs/:id/stats — update REC stats (SUPER_ADMIN, CONTINENTAL_ADMIN, REC_ADMIN)
  app.patch<{ Params: UuidParamInput; Body: RecStatsBodyInput }>('/api/v1/settings/recs/:id/stats', {
    schema: { params: UuidParamSchema, body: RecStatsBodySchema },
    preHandler: [...authAndTenant, rolesHook(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN, UserRole.REC_ADMIN)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.settingsService.updateRecStats(request.params.id, request.body.stats, user);
  });

  // ───────────────────── Countries ─────────────────────

  // GET /api/v1/settings/countries — list all countries (filtered by user scope)
  app.get<{ Querystring: SearchQueryInput }>('/api/v1/settings/countries', {
    schema: { querystring: SearchQuerySchema },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.settingsService.listCountries(request.query, user);
  });

  // GET /api/v1/settings/countries/:idOrCode — get country by UUID or code (scope-checked)
  app.get<{ Params: IdOrCodeParamInput }>('/api/v1/settings/countries/:idOrCode', {
    schema: { params: IdOrCodeParamSchema },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.settingsService.getCountryByIdOrCode(request.params.idOrCode, user);
  });

  // POST /api/v1/settings/countries — create country (SUPER_ADMIN)
  app.post<{ Body: CountryBodyInput }>('/api/v1/settings/countries', {
    schema: { body: CountryBodySchema },
    preHandler: [...authAndTenant, rolesHook(UserRole.SUPER_ADMIN)],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.settingsService.createCountry(request.body as Record<string, unknown>, user);
    return reply.code(201).send(result);
  });

  // PUT /api/v1/settings/countries/:id — update country (SUPER_ADMIN, CONTINENTAL_ADMIN)
  app.put<{ Params: UuidParamInput; Body: CountryBodyInput }>('/api/v1/settings/countries/:id', {
    schema: { params: UuidParamSchema, body: CountryBodySchema },
    preHandler: [...authAndTenant, rolesHook(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.settingsService.updateCountry(request.params.id, request.body as Record<string, unknown>, user);
  });

  // DELETE /api/v1/settings/countries/:id — delete country (SUPER_ADMIN)
  app.delete<{ Params: UuidParamInput }>('/api/v1/settings/countries/:id', {
    schema: { params: UuidParamSchema },
    preHandler: [...authAndTenant, rolesHook(UserRole.SUPER_ADMIN)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.settingsService.deleteCountry(request.params.id, user);
  });

  // PATCH /api/v1/settings/countries/:id/stats — update country stats
  app.patch<{ Params: UuidParamInput; Body: CountryStatsBodyInput }>('/api/v1/settings/countries/:id/stats', {
    schema: { params: UuidParamSchema, body: CountryStatsBodySchema },
    preHandler: [
      ...authAndTenant,
      rolesHook(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN, UserRole.REC_ADMIN, UserRole.NATIONAL_ADMIN),
    ],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.settingsService.updateCountryStats(request.params.id, request.body.stats, user);
  });

  // PATCH /api/v1/settings/countries/:id/sectors — update country sector performance
  app.patch<{ Params: UuidParamInput; Body: CountrySectorsBodyInput }>('/api/v1/settings/countries/:id/sectors', {
    schema: { params: UuidParamSchema, body: CountrySectorsBodySchema },
    preHandler: [
      ...authAndTenant,
      rolesHook(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN, UserRole.REC_ADMIN, UserRole.NATIONAL_ADMIN),
    ],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.settingsService.updateCountrySectors(request.params.id, request.body.sectorPerformance, user);
  });

  // POST /api/v1/settings/countries/:id/recs — add country to REC (SUPER_ADMIN)
  app.post<{ Params: UuidParamInput; Body: { recId: string } }>('/api/v1/settings/countries/:id/recs', {
    schema: {
      params: UuidParamSchema,
    },
    preHandler: [...authAndTenant, rolesHook(UserRole.SUPER_ADMIN)],
  }, async (request, reply) => {
    const result = await app.settingsService.addCountryRec(request.params.id, request.body.recId);
    return reply.code(201).send(result);
  });

  // DELETE /api/v1/settings/countries/:id/recs/:recId — remove country from REC (SUPER_ADMIN)
  app.delete<{ Params: CountryRecParamsInput }>('/api/v1/settings/countries/:id/recs/:recId', {
    schema: { params: CountryRecParamsSchema },
    preHandler: [...authAndTenant, rolesHook(UserRole.SUPER_ADMIN)],
  }, async (request) => {
    return app.settingsService.removeCountryRec(request.params.id, request.params.recId);
  });

  // ───────────────────── Admin Levels ─────────────────────

  // GET /api/v1/settings/countries/:id/admin-levels — list admin levels for a country
  app.get<{ Params: UuidParamInput }>('/api/v1/settings/countries/:id/admin-levels', {
    schema: { params: UuidParamSchema },
    preHandler: authAndTenant,
  }, async (request) => {
    return app.settingsService.listAdminLevels(request.params.id);
  });

  // PUT /api/v1/settings/countries/:id/admin-levels — bulk upsert admin levels
  app.put<{ Params: UuidParamInput; Body: AdminLevelsBulkBodyInput }>('/api/v1/settings/countries/:id/admin-levels', {
    schema: { params: UuidParamSchema, body: AdminLevelsBulkBodySchema },
    preHandler: [...authAndTenant, rolesHook(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.settingsService.upsertAdminLevels(request.params.id, request.body.levels, user);
  });

  // DELETE /api/v1/settings/countries/:id/admin-levels/:level — delete one admin level
  app.delete<{ Params: AdminLevelParamInput }>('/api/v1/settings/countries/:id/admin-levels/:level', {
    schema: { params: AdminLevelParamSchema },
    preHandler: [...authAndTenant, rolesHook(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.settingsService.deleteAdminLevel(request.params.id, request.params.level, user);
  });

  // ───────────────────── System Config ─────────────────────

  // GET /api/v1/settings/config — list all configs
  app.get('/api/v1/settings/config', {
    preHandler: authAndTenant,
  }, async () => {
    return app.settingsService.listConfigs();
  });

  // GET /api/v1/settings/config/:category — list configs by category
  app.get<{ Params: ConfigCategoryParamInput }>('/api/v1/settings/config/:category', {
    schema: { params: ConfigCategoryParamSchema },
    preHandler: authAndTenant,
  }, async (request) => {
    return app.settingsService.listConfigs(request.params.category);
  });

  // PUT /api/v1/settings/config/:category/:key — update config (SUPER_ADMIN)
  app.put<{ Params: ConfigKeyParamInput; Body: ConfigUpdateBodyInput }>('/api/v1/settings/config/:category/:key', {
    schema: { params: ConfigKeyParamSchema, body: ConfigUpdateBodySchema },
    preHandler: [...authAndTenant, rolesHook(UserRole.SUPER_ADMIN)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.settingsService.updateConfig(
      request.params.category,
      request.params.key,
      request.body.value,
      user,
    );
  });

  // POST /api/v1/settings/config/bulk — bulk update configs (SUPER_ADMIN)
  app.post<{ Body: ConfigBulkBodyInput }>('/api/v1/settings/config/bulk', {
    schema: { body: ConfigBulkBodySchema },
    preHandler: [...authAndTenant, rolesHook(UserRole.SUPER_ADMIN)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.settingsService.bulkUpdateConfigs(request.body.configs, user);
  });

  // ───────────────────── Domains ─────────────────────

  // GET /api/v1/settings/domains — list all domains
  app.get('/api/v1/settings/domains', {
    preHandler: authAndTenant,
  }, async () => {
    return app.settingsService.listDomains();
  });

  // PUT /api/v1/settings/domains/:id — update domain (SUPER_ADMIN)
  app.put<{ Params: UuidParamInput; Body: DomainBodyInput }>('/api/v1/settings/domains/:id', {
    schema: { params: UuidParamSchema, body: DomainBodySchema },
    preHandler: [...authAndTenant, rolesHook(UserRole.SUPER_ADMIN)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.settingsService.updateDomain(request.params.id, request.body as Record<string, unknown>, user);
  });

  // PATCH /api/v1/settings/domains/sort — update domain sort order (SUPER_ADMIN)
  app.patch<{ Body: DomainSortBodyInput }>('/api/v1/settings/domains/sort', {
    schema: { body: DomainSortBodySchema },
    preHandler: [...authAndTenant, rolesHook(UserRole.SUPER_ADMIN)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.settingsService.updateDomainSort(request.body.items, user);
  });

  // ───────────────────── Functions ─────────────────────

  // GET /api/v1/settings/functions — list functions (tenant-scoped)
  app.get<{ Querystring: FunctionQueryInput }>('/api/v1/settings/functions', {
    schema: { querystring: FunctionQuerySchema },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.settingsService.listFunctions(request.query, user);
  });

  // GET /api/v1/settings/functions/:id — get function detail (tenant-scoped)
  app.get<{ Params: UuidParamInput }>('/api/v1/settings/functions/:id', {
    schema: { params: UuidParamSchema },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.settingsService.getFunctionById(request.params.id, user);
  });

  // POST /api/v1/settings/functions — create function (SUPER_ADMIN, CONTINENTAL_ADMIN, REC_ADMIN, NATIONAL_ADMIN)
  app.post<{ Body: FunctionBodyInput }>('/api/v1/settings/functions', {
    schema: { body: FunctionBodySchema },
    preHandler: [...authAndTenant, rolesHook(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN, UserRole.REC_ADMIN, UserRole.NATIONAL_ADMIN)],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.settingsService.createFunction(request.body as Record<string, unknown>, user);
    return reply.code(201).send(result);
  });

  // PUT /api/v1/settings/functions/:id — update function (SUPER_ADMIN, CONTINENTAL_ADMIN, REC_ADMIN, NATIONAL_ADMIN)
  app.put<{ Params: UuidParamInput; Body: FunctionUpdateBodyInput }>('/api/v1/settings/functions/:id', {
    schema: { params: UuidParamSchema, body: FunctionUpdateBodySchema },
    preHandler: [...authAndTenant, rolesHook(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN, UserRole.REC_ADMIN, UserRole.NATIONAL_ADMIN)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.settingsService.updateFunction(request.params.id, request.body as Record<string, unknown>, user);
  });

  // DELETE /api/v1/settings/functions/:id — delete function (SUPER_ADMIN, CONTINENTAL_ADMIN, REC_ADMIN, NATIONAL_ADMIN; service-level scope check)
  app.delete<{ Params: UuidParamInput }>('/api/v1/settings/functions/:id', {
    schema: { params: UuidParamSchema },
    preHandler: [...authAndTenant, rolesHook(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN, UserRole.REC_ADMIN, UserRole.NATIONAL_ADMIN)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.settingsService.deleteFunction(request.params.id, user);
  });

  // ───────────────────── User-Function Assignment ─────────────────────

  // GET /api/v1/settings/users/:id/functions — get user's functions
  app.get<{ Params: UuidParamInput }>('/api/v1/settings/users/:id/functions', {
    schema: { params: UuidParamSchema },
    preHandler: authAndTenant,
  }, async (request) => {
    return app.settingsService.getUserFunctions(request.params.id);
  });

  // POST /api/v1/settings/users/:id/functions — assign function to user
  app.post<{ Params: UuidParamInput; Body: UserFunctionAssignBodyInput }>('/api/v1/settings/users/:id/functions', {
    schema: { params: UuidParamSchema, body: UserFunctionAssignBodySchema },
    preHandler: [...authAndTenant, rolesHook(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN, UserRole.REC_ADMIN, UserRole.NATIONAL_ADMIN)],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.settingsService.assignUserFunction(
      request.params.id,
      request.body.functionId,
      request.body.isPrimary ?? false,
      request.body.notes ?? null,
      user,
    );
    return reply.code(201).send(result);
  });

  // DELETE /api/v1/settings/users/:id/functions/:functionId — remove function from user
  app.delete<{ Params: UserFunctionRemoveParamsInput }>('/api/v1/settings/users/:id/functions/:functionId', {
    schema: { params: UserFunctionRemoveParamsSchema },
    preHandler: [...authAndTenant, rolesHook(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN, UserRole.REC_ADMIN, UserRole.NATIONAL_ADMIN)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.settingsService.removeUserFunction(request.params.id, request.params.functionId, user);
  });

  // ───────────────────── Users Management ─────────────────────

  // GET /api/v1/settings/users — list users (scope-filtered)
  app.get<{ Querystring: UserManagementQueryInput }>('/api/v1/settings/users', {
    schema: { querystring: UserManagementQuerySchema },
    preHandler: [...authAndTenant, rolesHook(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN, UserRole.REC_ADMIN, UserRole.NATIONAL_ADMIN)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.settingsService.listUsers(request.query, user);
  });

  // GET /api/v1/settings/users/:id — get user detail
  app.get<{ Params: UuidParamInput }>('/api/v1/settings/users/:id', {
    schema: { params: UuidParamSchema },
    preHandler: [...authAndTenant, rolesHook(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN, UserRole.REC_ADMIN, UserRole.NATIONAL_ADMIN)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.settingsService.getUserById(request.params.id, user);
  });

  // POST /api/v1/settings/users — create user
  app.post<{ Body: UserCreateBodyInput }>('/api/v1/settings/users', {
    schema: { body: UserCreateBodySchema },
    preHandler: [...authAndTenant, rolesHook(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN, UserRole.REC_ADMIN, UserRole.NATIONAL_ADMIN)],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.settingsService.createUser(request.body as Record<string, unknown>, user);
    return reply.code(201).send(result);
  });

  // PUT /api/v1/settings/users/:id — update user
  app.put<{ Params: UuidParamInput; Body: UserUpdateBodyInput }>('/api/v1/settings/users/:id', {
    schema: { params: UuidParamSchema, body: UserUpdateBodySchema },
    preHandler: [...authAndTenant, rolesHook(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN, UserRole.REC_ADMIN, UserRole.NATIONAL_ADMIN)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.settingsService.updateUser(request.params.id, request.body as Record<string, unknown>, user);
  });

  // PATCH /api/v1/settings/users/:id/password — reset user password
  app.patch<{ Params: UuidParamInput; Body: UserPasswordBodyInput }>('/api/v1/settings/users/:id/password', {
    schema: { params: UuidParamSchema, body: UserPasswordBodySchema },
    preHandler: [...authAndTenant, rolesHook(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.settingsService.resetUserPassword(request.params.id, request.body.password, user);
  });

  // DELETE /api/v1/settings/users/:id — delete user (SUPER_ADMIN)
  app.delete<{ Params: UuidParamInput }>('/api/v1/settings/users/:id', {
    schema: { params: UuidParamSchema },
    preHandler: [...authAndTenant, rolesHook(UserRole.SUPER_ADMIN)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.settingsService.deleteUser(request.params.id, user);
  });
}

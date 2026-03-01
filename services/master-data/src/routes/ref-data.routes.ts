import type { FastifyInstance } from 'fastify';
import { rolesHook, tenantHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

const REF_DATA_TYPES = [
  'species-groups',
  'species',
  'age-groups',
  'diseases',
  'clinical-signs',
  'control-measures',
  'seizure-reasons',
  'sample-types',
  'contamination-sources',
  'abattoirs',
  'markets',
  'checkpoints',
  'production-systems',
  // Phase 2 — 20 new types
  'breeds',
  'vaccine-types',
  'test-types',
  'labs',
  'livestock-products',
  'census-methodologies',
  'gear-types',
  'vessel-types',
  'aquaculture-farm-types',
  'landing-sites',
  'conservation-statuses',
  'habitat-types',
  'crime-types',
  'commodities',
  'hive-types',
  'bee-diseases',
  'floral-sources',
  'legal-framework-types',
  'stakeholder-types',
];

export async function registerRefDataRoutes(app: FastifyInstance): Promise<void> {
  const authAndTenant = [app.authHookFn, tenantHook()];
  const adminRoles = rolesHook(
    UserRole.SUPER_ADMIN,
    UserRole.CONTINENTAL_ADMIN,
    UserRole.REC_ADMIN,
    UserRole.NATIONAL_ADMIN,
  );

  // ── Dashboard counts ──
  app.get('/api/v1/master-data/ref/counts', {
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.refDataService.getCounts(user);
  });

  // ── Generic CRUD for each type ──
  for (const type of REF_DATA_TYPES) {
    const prefix = `/api/v1/master-data/ref/${type}`;

    // List with cascade filtering
    app.get<{
      Querystring: Record<string, string | undefined>;
    }>(prefix, {
      preHandler: authAndTenant,
    }, async (request) => {
      const user = request.user as AuthenticatedUser;
      return app.refDataService.findAll(type, request.query as Record<string, string | undefined>, user);
    });

    // Optimized for Select dropdowns
    app.get<{
      Querystring: Record<string, string | undefined>;
    }>(`${prefix}/for-select`, {
      preHandler: authAndTenant,
    }, async (request) => {
      const user = request.user as AuthenticatedUser;
      return app.refDataService.findForSelect(type, request.query as Record<string, string | undefined>, user);
    });

    // Get one
    app.get<{ Params: { id: string } }>(`${prefix}/:id`, {
      preHandler: authAndTenant,
    }, async (request) => {
      return app.refDataService.findOne(type, request.params.id);
    });

    // Create
    app.post<{ Body: any }>(prefix, {
      preHandler: [...authAndTenant, adminRoles],
    }, async (request, reply) => {
      const user = request.user as AuthenticatedUser;
      return reply.code(201).send(await app.refDataService.create(type, request.body, user));
    });

    // Update
    app.put<{ Params: { id: string }; Body: any }>(`${prefix}/:id`, {
      preHandler: [...authAndTenant, adminRoles],
    }, async (request) => {
      const user = request.user as AuthenticatedUser;
      return app.refDataService.update(type, request.params.id, request.body, user);
    });

    // Deactivate (soft delete)
    app.delete<{ Params: { id: string } }>(`${prefix}/:id`, {
      preHandler: [...authAndTenant, adminRoles],
    }, async (request) => {
      const user = request.user as AuthenticatedUser;
      return app.refDataService.deactivate(type, request.params.id, user);
    });
  }
}

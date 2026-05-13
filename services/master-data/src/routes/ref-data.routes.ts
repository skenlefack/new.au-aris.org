import type { FastifyInstance } from 'fastify';
import { rolesHook, tenantHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { getAllowedRefDataTypes } from '../domain-map.js';

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
  // Phase 3 — Infrastructures & Institutions
  'infrastructures',
  // Phase 4 — WOAH/References-data enrichment (13 new types)
  'diagnosis-bases',
  'body-parts',
  'causal-agent-types',
  'outbreak-statuses',
  'epidemiological-unit-types',
  'notification-reasons',
  'source-of-infections',
  'transport-modes',
  'animal-sexes',
  'animal-husbandries',
  'genetic-diversities',
  'data-sources',
  'fish-families',
];

export async function registerRefDataRoutes(app: FastifyInstance): Promise<void> {
  const authAndTenant = [app.authHookFn, tenantHook()];
  const adminRoles = rolesHook(
    UserRole.SUPER_ADMIN,
    UserRole.CONTINENTAL_ADMIN,
    UserRole.REC_ADMIN,
    UserRole.NATIONAL_ADMIN,
  );

  /** Filter ref-data type access by user domains (SUPER_ADMIN sees all) */
  function assertTypeAccess(type: string, user: { role?: string; domains?: string[] }): void {
    if (user.role === 'SUPER_ADMIN') return;
    const userDomains = Object.keys((user as any).domains ?? {});
    if (userDomains.length === 0) return; // no restriction if no domains assigned
    const allowed = getAllowedRefDataTypes(userDomains);
    if (!allowed.has(type)) {
      const err = new Error(`Access denied: ref-data type '${type}' is not in your domain scope`) as Error & { statusCode: number };
      err.statusCode = 403;
      throw err;
    }
  }

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
      assertTypeAccess(type, user);
      return app.refDataService.findAll(type, request.query as Record<string, string | undefined>, user);
    });

    // Optimized for Select dropdowns
    app.get<{
      Querystring: Record<string, string | undefined>;
    }>(`${prefix}/for-select`, {
      preHandler: authAndTenant,
    }, async (request) => {
      const user = request.user as AuthenticatedUser;
      assertTypeAccess(type, user);
      return app.refDataService.findForSelect(type, request.query as Record<string, string | undefined>, user);
    });

    // Get one
    app.get<{ Params: { id: string } }>(`${prefix}/:id`, {
      preHandler: authAndTenant,
    }, async (request) => {
      const user = request.user as AuthenticatedUser;
      assertTypeAccess(type, user);
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

  // ── Special /for-select routes for non-ref tables (countries, geo-entities, units) ──

  app.get<{ Querystring: Record<string, string | undefined> }>('/api/v1/master-data/ref/countries/for-select', {
    preHandler: authAndTenant,
  }, async (request) => {
    const search = request.query.search;
    const where: Record<string, unknown> = { is_active: true };
    if (search) {
      where['OR'] = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { path: ['en'], string_contains: search } },
        { name: { path: ['fr'], string_contains: search } },
      ];
    }
    const rows = await (app.prisma as any).country.findMany({
      where,
      select: { id: true, code: true, name: true, flag: true },
      orderBy: { sort_order: 'asc' },
      take: 200,
    });
    return { data: rows.map((r: any) => ({ id: r.id, code: r.code, name: r.name, flag: r.flag })) };
  });

  app.get<{ Querystring: Record<string, string | undefined> }>('/api/v1/master-data/ref/geo-entities/for-select', {
    preHandler: authAndTenant,
  }, async (request) => {
    const { search, level, countryCode, parentId } = request.query;
    const where: Record<string, unknown> = { isActive: true };
    if (level) where['level'] = level;
    if (countryCode) where['countryCode'] = countryCode;
    if (parentId) where['parentId'] = parentId;
    if (search) {
      where['OR'] = [
        { code: { contains: search, mode: 'insensitive' } },
        { nameEn: { contains: search, mode: 'insensitive' } },
        { nameFr: { contains: search, mode: 'insensitive' } },
      ];
    }
    const rows = await (app.prisma as any).geoEntity.findMany({
      where,
      select: { id: true, code: true, nameEn: true, nameFr: true, namePt: true, nameAr: true, level: true, countryCode: true },
      orderBy: { nameEn: 'asc' },
      take: 500,
    });
    return {
      data: rows.map((r: any) => ({
        id: r.id,
        code: r.code,
        name: { en: r.nameEn, fr: r.nameFr, pt: r.namePt, ar: r.nameAr },
        level: r.level,
        countryCode: r.countryCode,
      })),
    };
  });

  app.get<{ Querystring: Record<string, string | undefined> }>('/api/v1/master-data/ref/units/for-select', {
    preHandler: authAndTenant,
  }, async (request) => {
    const { search, category } = request.query;
    const where: Record<string, unknown> = { isActive: true };
    if (category) where['category'] = category;
    if (search) {
      where['OR'] = [
        { code: { contains: search, mode: 'insensitive' } },
        { nameEn: { contains: search, mode: 'insensitive' } },
        { nameFr: { contains: search, mode: 'insensitive' } },
      ];
    }
    const rows = await (app.prisma as any).unit.findMany({
      where,
      select: { id: true, code: true, nameEn: true, nameFr: true, symbol: true, category: true },
      orderBy: { nameEn: 'asc' },
      take: 200,
    });
    return {
      data: rows.map((r: any) => ({
        id: r.id,
        code: r.code,
        name: { en: `${r.nameEn} (${r.symbol})`, fr: `${r.nameFr} (${r.symbol})` },
        category: r.category,
      })),
    };
  });
}

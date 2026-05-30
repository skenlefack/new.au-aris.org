import type { FastifyInstance } from 'fastify';
import { tenantHook } from '@aris/auth-middleware/fastify';

/**
 * PAID reference data routes — read-only endpoints for PAID form selects.
 * Data lives in animal_health.paid_* tables (seeded from FAO Kobo Excel).
 */
export async function registerPaidRefRoutes(app: FastifyInstance): Promise<void> {
  const authAndTenant = [app.authHookFn, tenantHook()];
  const prisma = app.prisma as any;

  // Helper: paginated raw query
  async function paginatedQuery(
    table: string,
    query: { page?: string; limit?: string; search?: string; sector?: string; species?: string; country?: string },
  ) {
    const page = Math.max(1, parseInt(query.page ?? '1', 10));
    const limit = Math.min(500, Math.max(1, parseInt(query.limit ?? '100', 10)));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (query.search) {
      conditions.push(`(name_en ILIKE $${paramIdx} OR COALESCE(name_fr,'') ILIKE $${paramIdx})`);
      params.push(`%${query.search}%`);
      paramIdx++;
    }
    if (query.sector) {
      conditions.push(`sector_code = $${paramIdx}`);
      params.push(query.sector);
      paramIdx++;
    }
    if (query.species) {
      conditions.push(`species_code = $${paramIdx}`);
      params.push(query.species);
      paramIdx++;
    }
    if (query.country) {
      conditions.push(`country = $${paramIdx}`);
      params.push(query.country);
      paramIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [data, countResult] = await Promise.all([
      prisma.$queryRawUnsafe(
        `SELECT * FROM animal_health.${table} ${whereClause} ORDER BY name_en LIMIT ${limit} OFFSET ${offset}`,
        ...params,
      ),
      prisma.$queryRawUnsafe(
        `SELECT count(*)::int as total FROM animal_health.${table} ${whereClause}`,
        ...params,
      ),
    ]);

    const total = (countResult as any[])[0]?.total ?? 0;
    return { data, meta: { total, page, limit } };
  }

  // ── Sectors ──
  app.get<{ Querystring: { search?: string } }>(
    '/api/v1/master-data/paid/sectors',
    { preHandler: authAndTenant },
    async (request) => paginatedQuery('paid_sectors', request.query),
  );

  // ── Activities (filter by sector) ──
  app.get<{ Querystring: { search?: string; sector?: string; page?: string; limit?: string } }>(
    '/api/v1/master-data/paid/activities',
    { preHandler: authAndTenant },
    async (request) => paginatedQuery('paid_activities', request.query),
  );

  // ── Species (filter by sector) ──
  app.get<{ Querystring: { search?: string; sector?: string; page?: string; limit?: string } }>(
    '/api/v1/master-data/paid/species',
    { preHandler: authAndTenant },
    async (request) => paginatedQuery('paid_species', request.query),
  );

  // ── Production Systems (filter by sector, species) ──
  app.get<{ Querystring: { search?: string; sector?: string; species?: string; page?: string; limit?: string } }>(
    '/api/v1/master-data/paid/production-systems',
    { preHandler: authAndTenant },
    async (request) => paginatedQuery('paid_production_systems', request.query),
  );

  // ── Diseases (filter by sector, species) ──
  app.get<{ Querystring: { search?: string; sector?: string; species?: string; page?: string; limit?: string } }>(
    '/api/v1/master-data/paid/diseases',
    { preHandler: authAndTenant },
    async (request) => paginatedQuery('paid_diseases', request.query),
  );

  // ── Projects (filter by country) ──
  app.get<{ Querystring: { search?: string; country?: string; page?: string; limit?: string } }>(
    '/api/v1/master-data/paid/projects',
    { preHandler: authAndTenant },
    async (request) => {
      const q = request.query;
      const page = Math.max(1, parseInt(q.page ?? '1', 10));
      const limit = Math.min(500, Math.max(1, parseInt(q.limit ?? '100', 10)));
      const offset = (page - 1) * limit;

      const conditions: string[] = [];
      const params: unknown[] = [];
      let paramIdx = 1;

      if (q.search) {
        conditions.push(`(title ILIKE $${paramIdx} OR code ILIKE $${paramIdx})`);
        params.push(`%${q.search}%`);
        paramIdx++;
      }
      if (q.country) {
        conditions.push(`country = $${paramIdx}`);
        params.push(q.country);
        paramIdx++;
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const [data, countResult] = await Promise.all([
        prisma.$queryRawUnsafe(`SELECT * FROM animal_health.paid_projects ${where} ORDER BY title LIMIT ${limit} OFFSET ${offset}`, ...params),
        prisma.$queryRawUnsafe(`SELECT count(*)::int as total FROM animal_health.paid_projects ${where}`, ...params),
      ]);

      return { data, meta: { total: (countResult as any[])[0]?.total ?? 0, page, limit } };
    },
  );

  // ── Partners International ──
  app.get<{ Querystring: { search?: string; page?: string; limit?: string } }>(
    '/api/v1/master-data/paid/partners-intl',
    { preHandler: authAndTenant },
    async (request) => paginatedQuery('paid_partners_intl', request.query),
  );

  // ── Partners National (filter by country) ──
  app.get<{ Querystring: { search?: string; country?: string; page?: string; limit?: string } }>(
    '/api/v1/master-data/paid/partners-national',
    { preHandler: authAndTenant },
    async (request) => paginatedQuery('paid_partners_national', request.query),
  );
}

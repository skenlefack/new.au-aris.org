import type { FastifyInstance } from 'fastify';
import { rolesHook, tenantHook, domainsHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

class HttpError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

const IMPORT_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.CONTINENTAL_ADMIN,
  UserRole.NATIONAL_ADMIN,
] as const;

export async function registerImportRoutes(app: FastifyInstance): Promise<void> {
  const authAndTenant = [app.authHookFn, tenantHook(), domainsHook('trade-sps')];

  // ---------------------------------------------------------------------------
  // POST /api/v1/trade/flows/import
  // ---------------------------------------------------------------------------
  app.post('/api/v1/trade/flows/import', {
    preHandler: [...authAndTenant, rolesHook(...IMPORT_ROLES)],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const data = await request.file();
    if (!data) throw new HttpError(400, 'No file uploaded');

    const buffer = await data.toBuffer();
    const format = data.filename.endsWith('.csv') ? 'csv' : 'xlsx';
    const result = await app.importService.importTradeFlows(buffer, format as 'xlsx' | 'csv', user);
    return reply.code(200).send({ data: result });
  });

  // ---------------------------------------------------------------------------
  // POST /api/v1/trade/market-prices/import
  // ---------------------------------------------------------------------------
  app.post('/api/v1/trade/market-prices/import', {
    preHandler: [...authAndTenant, rolesHook(...IMPORT_ROLES)],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const data = await request.file();
    if (!data) throw new HttpError(400, 'No file uploaded');

    const buffer = await data.toBuffer();
    const format = data.filename.endsWith('.csv') ? 'csv' : 'xlsx';
    const result = await app.importService.importMarketPrices(buffer, format as 'xlsx' | 'csv', user);
    return reply.code(200).send({ data: result });
  });

  // ---------------------------------------------------------------------------
  // GET /api/v1/trade/flows/import/template
  // ---------------------------------------------------------------------------
  app.get('/api/v1/trade/flows/import/template', {
    preHandler: [...authAndTenant, rolesHook(...IMPORT_ROLES)],
  }, async (_request, reply) => {
    const buffer = await app.importService.getTemplate('flows');
    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    reply.header('Content-Disposition', 'attachment; filename=trade-flows-import-template.xlsx');
    return reply.send(buffer);
  });

  // ---------------------------------------------------------------------------
  // GET /api/v1/trade/market-prices/import/template
  // ---------------------------------------------------------------------------
  app.get('/api/v1/trade/market-prices/import/template', {
    preHandler: [...authAndTenant, rolesHook(...IMPORT_ROLES)],
  }, async (_request, reply) => {
    const buffer = await app.importService.getTemplate('market-prices');
    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    reply.header('Content-Disposition', 'attachment; filename=market-prices-import-template.xlsx');
    return reply.send(buffer);
  });
}

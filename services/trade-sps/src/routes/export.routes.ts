import type { FastifyInstance } from 'fastify';
import { rolesHook, tenantHook, domainsHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

const EXPORT_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.CONTINENTAL_ADMIN,
  UserRole.REC_ADMIN,
  UserRole.NATIONAL_ADMIN,
  UserRole.DATA_STEWARD,
] as const;

const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const CSV_CONTENT_TYPE = 'text/csv';

function parseFormat(raw?: string): 'xlsx' | 'csv' {
  if (raw === 'csv') return 'csv';
  return 'xlsx';
}

function contentType(format: 'xlsx' | 'csv'): string {
  return format === 'csv' ? CSV_CONTENT_TYPE : XLSX_CONTENT_TYPE;
}

function disposition(name: string, format: 'xlsx' | 'csv', year?: number): string {
  const suffix = year ? `_${year}` : '';
  return `attachment; filename="${name}${suffix}.${format}"`;
}

export async function registerExportRoutes(app: FastifyInstance): Promise<void> {
  const authAndTenant = [app.authHookFn, tenantHook(), domainsHook('trade-sps')];

  // GET /api/v1/trade/flows/export
  app.get<{
    Querystring: {
      format?: string;
      year?: string;
      commodityGroup?: string;
      flowDirection?: string;
      speciesId?: string;
    };
  }>('/api/v1/trade/flows/export', {
    preHandler: [...authAndTenant, rolesHook(...EXPORT_ROLES)],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const format = parseFormat(request.query.format);
    const year = request.query.year ? parseInt(request.query.year, 10) : undefined;

    const buffer = await app.exportService.exportTradeFlows(
      {
        year,
        commodityGroup: request.query.commodityGroup,
        flowDirection: request.query.flowDirection,
        speciesId: request.query.speciesId,
      },
      format,
      user,
    );

    return reply
      .header('Content-Type', contentType(format))
      .header('Content-Disposition', disposition('trade_flows', format, year))
      .send(buffer);
  });

  // GET /api/v1/trade/sps-certificates/export
  app.get<{
    Querystring: {
      format?: string;
      year?: string;
      status?: string;
      originCountryId?: string;
      destinationCountryId?: string;
      speciesId?: string;
    };
  }>('/api/v1/trade/sps-certificates/export', {
    preHandler: [...authAndTenant, rolesHook(...EXPORT_ROLES)],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const format = parseFormat(request.query.format);
    const year = request.query.year ? parseInt(request.query.year, 10) : undefined;

    const buffer = await app.exportService.exportSpsCertificates(
      {
        year,
        status: request.query.status,
        originCountryId: request.query.originCountryId,
        destinationCountryId: request.query.destinationCountryId,
        speciesId: request.query.speciesId,
      },
      format,
      user,
    );

    return reply
      .header('Content-Type', contentType(format))
      .header('Content-Disposition', disposition('sps_certificates', format, year))
      .send(buffer);
  });

  // GET /api/v1/trade/market-prices/export
  app.get<{
    Querystring: {
      format?: string;
      year?: string;
      marketId?: string;
      speciesId?: string;
      priceType?: string;
    };
  }>('/api/v1/trade/market-prices/export', {
    preHandler: [...authAndTenant, rolesHook(...EXPORT_ROLES)],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const format = parseFormat(request.query.format);
    const year = request.query.year ? parseInt(request.query.year, 10) : undefined;

    const buffer = await app.exportService.exportMarketPrices(
      {
        year,
        marketId: request.query.marketId,
        speciesId: request.query.speciesId,
        priceType: request.query.priceType,
      },
      format,
      user,
    );

    return reply
      .header('Content-Type', contentType(format))
      .header('Content-Disposition', disposition('market_prices', format, year))
      .send(buffer);
  });
}

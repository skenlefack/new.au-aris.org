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
  const authAndTenant = [app.authHookFn, tenantHook(), domainsHook('fisheries')];

  // GET /api/v1/fisheries/captures/export
  app.get<{
    Querystring: { format?: string; year?: string; speciesId?: string; faoAreaCode?: string; status?: string };
  }>('/api/v1/fisheries/captures/export', {
    preHandler: [...authAndTenant, rolesHook(...EXPORT_ROLES)],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const format = parseFormat(request.query.format);
    const year = request.query.year ? parseInt(request.query.year, 10) : undefined;

    const buffer = await app.exportService.exportCaptures(
      {
        year,
        speciesId: request.query.speciesId,
        faoAreaCode: request.query.faoAreaCode,
        status: request.query.status,
      },
      format,
      user,
    );

    return reply
      .header('Content-Type', contentType(format))
      .header('Content-Disposition', disposition('captures', format, year))
      .send(buffer);
  });

  // GET /api/v1/fisheries/vessels/export
  app.get<{
    Querystring: { format?: string; status?: string };
  }>('/api/v1/fisheries/vessels/export', {
    preHandler: [...authAndTenant, rolesHook(...EXPORT_ROLES)],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const format = parseFormat(request.query.format);

    const buffer = await app.exportService.exportVessels(
      { status: request.query.status },
      format,
      user,
    );

    return reply
      .header('Content-Type', contentType(format))
      .header('Content-Disposition', disposition('vessels', format))
      .send(buffer);
  });

  // GET /api/v1/fisheries/aquaculture/farms/export
  app.get<{
    Querystring: { format?: string };
  }>('/api/v1/fisheries/aquaculture/farms/export', {
    preHandler: [...authAndTenant, rolesHook(...EXPORT_ROLES)],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const format = parseFormat(request.query.format);

    const buffer = await app.exportService.exportFarms({}, format, user);

    return reply
      .header('Content-Type', contentType(format))
      .header('Content-Disposition', disposition('aquaculture_farms', format))
      .send(buffer);
  });

  // GET /api/v1/fisheries/aquaculture/production/export
  app.get<{
    Querystring: { format?: string; year?: string; speciesId?: string };
  }>('/api/v1/fisheries/aquaculture/production/export', {
    preHandler: [...authAndTenant, rolesHook(...EXPORT_ROLES)],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const format = parseFormat(request.query.format);
    const year = request.query.year ? parseInt(request.query.year, 10) : undefined;

    const buffer = await app.exportService.exportProduction(
      { year, speciesId: request.query.speciesId },
      format,
      user,
    );

    return reply
      .header('Content-Type', contentType(format))
      .header('Content-Disposition', disposition('aquaculture_production', format, year))
      .send(buffer);
  });

  // GET /api/v1/fisheries/efforts/export
  app.get<{
    Querystring: { format?: string; year?: string; faoAreaCode?: string };
  }>('/api/v1/fisheries/efforts/export', {
    preHandler: [...authAndTenant, rolesHook(...EXPORT_ROLES)],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const format = parseFormat(request.query.format);
    const year = request.query.year ? parseInt(request.query.year, 10) : undefined;

    const buffer = await app.exportService.exportEfforts(
      { year, faoAreaCode: request.query.faoAreaCode },
      format,
      user,
    );

    return reply
      .header('Content-Type', contentType(format))
      .header('Content-Disposition', disposition('fishing_efforts', format, year))
      .send(buffer);
  });

  // GET /api/v1/fisheries/export/fishstatj
  app.get<{
    Querystring: { year?: string };
  }>('/api/v1/fisheries/export/fishstatj', {
    preHandler: [...authAndTenant, rolesHook(...EXPORT_ROLES)],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const year = request.query.year
      ? parseInt(request.query.year, 10)
      : new Date().getFullYear();

    const buffer = await app.exportService.exportFishStatJ(year, user);

    return reply
      .header('Content-Type', CSV_CONTENT_TYPE)
      .header('Content-Disposition', `attachment; filename="fishstatj_${year}.csv"`)
      .send(buffer);
  });
}

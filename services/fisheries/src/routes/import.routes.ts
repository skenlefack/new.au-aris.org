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
  const authAndTenant = [app.authHookFn, tenantHook(), domainsHook('fisheries')];

  // ---------------------------------------------------------------------------
  // POST /api/v1/fisheries/captures/import
  // ---------------------------------------------------------------------------
  app.post('/api/v1/fisheries/captures/import', {
    preHandler: [...authAndTenant, rolesHook(...IMPORT_ROLES)],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const data = await request.file();
    if (!data) throw new HttpError(400, 'No file uploaded');

    const buffer = await data.toBuffer();
    const format = data.filename.endsWith('.csv') ? 'csv' : 'xlsx';
    const result = await app.importService.importCaptures(buffer, format as 'xlsx' | 'csv', user);
    return reply.code(200).send({ data: result });
  });

  // ---------------------------------------------------------------------------
  // POST /api/v1/fisheries/vessels/import
  // ---------------------------------------------------------------------------
  app.post('/api/v1/fisheries/vessels/import', {
    preHandler: [...authAndTenant, rolesHook(...IMPORT_ROLES)],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const data = await request.file();
    if (!data) throw new HttpError(400, 'No file uploaded');

    const buffer = await data.toBuffer();
    const format = data.filename.endsWith('.csv') ? 'csv' : 'xlsx';
    const result = await app.importService.importVessels(buffer, format as 'xlsx' | 'csv', user);
    return reply.code(200).send({ data: result });
  });

  // ---------------------------------------------------------------------------
  // POST /api/v1/fisheries/aquaculture/farms/import
  // ---------------------------------------------------------------------------
  app.post('/api/v1/fisheries/aquaculture/farms/import', {
    preHandler: [...authAndTenant, rolesHook(...IMPORT_ROLES)],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const data = await request.file();
    if (!data) throw new HttpError(400, 'No file uploaded');

    const buffer = await data.toBuffer();
    const format = data.filename.endsWith('.csv') ? 'csv' : 'xlsx';
    const result = await app.importService.importFarms(buffer, format as 'xlsx' | 'csv', user);
    return reply.code(200).send({ data: result });
  });

  // ---------------------------------------------------------------------------
  // POST /api/v1/fisheries/aquaculture/production/import
  // ---------------------------------------------------------------------------
  app.post('/api/v1/fisheries/aquaculture/production/import', {
    preHandler: [...authAndTenant, rolesHook(...IMPORT_ROLES)],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const data = await request.file();
    if (!data) throw new HttpError(400, 'No file uploaded');

    const buffer = await data.toBuffer();
    const format = data.filename.endsWith('.csv') ? 'csv' : 'xlsx';
    const result = await app.importService.importProduction(buffer, format as 'xlsx' | 'csv', user);
    return reply.code(200).send({ data: result });
  });

  // ---------------------------------------------------------------------------
  // POST /api/v1/fisheries/efforts/import
  // ---------------------------------------------------------------------------
  app.post('/api/v1/fisheries/efforts/import', {
    preHandler: [...authAndTenant, rolesHook(...IMPORT_ROLES)],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const data = await request.file();
    if (!data) throw new HttpError(400, 'No file uploaded');

    const buffer = await data.toBuffer();
    const format = data.filename.endsWith('.csv') ? 'csv' : 'xlsx';
    const result = await app.importService.importEfforts(buffer, format as 'xlsx' | 'csv', user);
    return reply.code(200).send({ data: result });
  });

  // ---------------------------------------------------------------------------
  // GET /api/v1/fisheries/captures/import/template
  // ---------------------------------------------------------------------------
  app.get('/api/v1/fisheries/captures/import/template', {
    preHandler: [...authAndTenant, rolesHook(...IMPORT_ROLES)],
  }, async (_request, reply) => {
    const buffer = await app.importService.getTemplate('captures');
    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    reply.header('Content-Disposition', 'attachment; filename=captures-import-template.xlsx');
    return reply.send(buffer);
  });

  // ---------------------------------------------------------------------------
  // GET /api/v1/fisheries/vessels/import/template
  // ---------------------------------------------------------------------------
  app.get('/api/v1/fisheries/vessels/import/template', {
    preHandler: [...authAndTenant, rolesHook(...IMPORT_ROLES)],
  }, async (_request, reply) => {
    const buffer = await app.importService.getTemplate('vessels');
    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    reply.header('Content-Disposition', 'attachment; filename=vessels-import-template.xlsx');
    return reply.send(buffer);
  });

  // ---------------------------------------------------------------------------
  // GET /api/v1/fisheries/aquaculture/farms/import/template
  // ---------------------------------------------------------------------------
  app.get('/api/v1/fisheries/aquaculture/farms/import/template', {
    preHandler: [...authAndTenant, rolesHook(...IMPORT_ROLES)],
  }, async (_request, reply) => {
    const buffer = await app.importService.getTemplate('farms');
    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    reply.header('Content-Disposition', 'attachment; filename=aquaculture-farms-import-template.xlsx');
    return reply.send(buffer);
  });

  // ---------------------------------------------------------------------------
  // GET /api/v1/fisheries/aquaculture/production/import/template
  // ---------------------------------------------------------------------------
  app.get('/api/v1/fisheries/aquaculture/production/import/template', {
    preHandler: [...authAndTenant, rolesHook(...IMPORT_ROLES)],
  }, async (_request, reply) => {
    const buffer = await app.importService.getTemplate('production');
    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    reply.header('Content-Disposition', 'attachment; filename=aquaculture-production-import-template.xlsx');
    return reply.send(buffer);
  });

  // ---------------------------------------------------------------------------
  // GET /api/v1/fisheries/efforts/import/template
  // ---------------------------------------------------------------------------
  app.get('/api/v1/fisheries/efforts/import/template', {
    preHandler: [...authAndTenant, rolesHook(...IMPORT_ROLES)],
  }, async (_request, reply) => {
    const buffer = await app.importService.getTemplate('efforts');
    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    reply.header('Content-Disposition', 'attachment; filename=efforts-import-template.xlsx');
    return reply.send(buffer);
  });
}

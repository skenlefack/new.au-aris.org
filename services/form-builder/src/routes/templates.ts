import type { FastifyInstance } from 'fastify';
import { UserRole } from '@aris/shared-types';
import { authHook, rolesHook, tenantHook } from '@aris/auth-middleware';
import type { AuthenticatedUser, AuthHookOptions } from '@aris/auth-middleware';
import { TemplateService } from '../services/template.service';
import {
  CreateTemplateSchema,
  UpdateTemplateSchema,
  ListTemplatesQuerySchema,
  IdParamSchema,
} from '../schemas/template.schema';
import type {
  CreateTemplateBody,
  UpdateTemplateBody,
  ListTemplatesQuery,
  IdParam,
} from '../schemas/template.schema';

const WRITE_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.CONTINENTAL_ADMIN,
  UserRole.REC_ADMIN,
  UserRole.NATIONAL_ADMIN,
  UserRole.DATA_STEWARD,
];

const PUBLISH_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.CONTINENTAL_ADMIN,
  UserRole.REC_ADMIN,
  UserRole.NATIONAL_ADMIN,
];

const ARCHIVE_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.CONTINENTAL_ADMIN,
];

export default async function templateRoutes(app: FastifyInstance): Promise<void> {
  const service = new TemplateService(app.prisma, app.kafka.producer);

  const authOpts: AuthHookOptions = {
    publicKey: process.env['JWT_PUBLIC_KEY'] ?? '',
  };
  const auth = authHook(authOpts);
  const tenant = tenantHook();

  // POST /api/v1/form-builder/templates
  app.post<{ Body: CreateTemplateBody }>('/api/v1/form-builder/templates', {
    schema: { body: CreateTemplateSchema },
    preHandler: [auth, tenant, rolesHook(...WRITE_ROLES)],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await service.create(request.body, user);
    return reply.code(201).send(result);
  });

  // GET /api/v1/form-builder/templates
  app.get<{ Querystring: ListTemplatesQuery }>('/api/v1/form-builder/templates', {
    schema: { querystring: ListTemplatesQuerySchema },
    preHandler: [auth, tenant],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return service.findAll(user, request.query);
  });

  // GET /api/v1/form-builder/templates/:id?tenantId=<uuid>
  app.get<{ Params: IdParam; Querystring: { tenantId?: string } }>('/api/v1/form-builder/templates/:id', {
    schema: { params: IdParamSchema },
    preHandler: [auth, tenant],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    const resolveTenantId = (request.query as Record<string, string>).tenantId;
    return service.findOne(request.params.id, user, resolveTenantId);
  });

  // PATCH /api/v1/form-builder/templates/:id
  app.patch<{ Params: IdParam; Body: UpdateTemplateBody }>('/api/v1/form-builder/templates/:id', {
    schema: { params: IdParamSchema, body: UpdateTemplateSchema },
    preHandler: [auth, tenant, rolesHook(...WRITE_ROLES)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return service.update(request.params.id, request.body, user);
  });

  // POST /api/v1/form-builder/templates/:id/publish
  app.post<{ Params: IdParam }>('/api/v1/form-builder/templates/:id/publish', {
    schema: { params: IdParamSchema },
    preHandler: [auth, tenant, rolesHook(...PUBLISH_ROLES)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return service.publish(request.params.id, user);
  });

  // POST /api/v1/form-builder/templates/:id/archive
  app.post<{ Params: IdParam }>('/api/v1/form-builder/templates/:id/archive', {
    schema: { params: IdParamSchema },
    preHandler: [auth, tenant, rolesHook(...ARCHIVE_ROLES)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return service.archive(request.params.id, user);
  });

  // GET /api/v1/form-builder/templates/:id/preview
  app.get<{ Params: IdParam }>('/api/v1/form-builder/templates/:id/preview', {
    schema: { params: IdParamSchema },
    preHandler: [auth, tenant],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return service.preview(request.params.id, user);
  });

  // POST /api/v1/form-builder/templates/:id/duplicate
  app.post<{ Params: IdParam }>('/api/v1/form-builder/templates/:id/duplicate', {
    schema: { params: IdParamSchema },
    preHandler: [auth, tenant, rolesHook(...WRITE_ROLES)],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await service.duplicate(request.params.id, user);
    return reply.code(201).send(result);
  });

  // POST /api/v1/form-builder/templates/import-excel
  app.post('/api/v1/form-builder/templates/import-excel', {
    preHandler: [auth, tenant, rolesHook(...WRITE_ROLES)],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const file = await request.file();
    if (!file) {
      return reply.code(400).send({ statusCode: 400, message: 'No file uploaded' });
    }
    const buffer = await file.toBuffer();
    const name = (request.query as Record<string, string>).name || file.filename.replace(/\.(xlsx?|csv)$/i, '');
    const domain = (request.query as Record<string, string>).domain || 'general';
    const result = await service.importFromExcel(buffer, { name, domain }, user);
    return reply.code(201).send(result);
  });

  // DELETE /api/v1/form-builder/templates/:id
  app.delete<{ Params: IdParam }>('/api/v1/form-builder/templates/:id', {
    schema: { params: IdParamSchema },
    preHandler: [auth, tenant, rolesHook(...WRITE_ROLES)],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    await service.remove(request.params.id, user);
    return reply.code(204).send();
  });
}

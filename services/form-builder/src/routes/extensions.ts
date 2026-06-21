import { readFileSync } from 'fs';
import type { FastifyInstance } from 'fastify';
import { UserRole } from '@aris/shared-types';
import { authHook, rolesHook, tenantHook } from '@aris/auth-middleware';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { ExtensionService } from '../services/extension.service';
import {
  BaseFormIdParamSchema,
  ExtensionIdParamSchema,
  ExtensionFieldIdParamSchema,
  EffectiveFormParamSchema,
  ListExtensionsQuerySchema,
  EffectiveFormQuerySchema,
  CreateExtensionBodySchema,
  AddExtensionFieldBodySchema,
  UpdateExtensionFieldBodySchema,
} from '../schemas/extension.schema';
import type {
  BaseFormIdParam,
  ExtensionIdParam,
  ExtensionFieldIdParam,
  EffectiveFormParam,
  ListExtensionsQuery,
  EffectiveFormQuery,
  CreateExtensionBody,
  AddExtensionFieldBody,
  UpdateExtensionFieldBody,
} from '../schemas/extension.schema';

const EXTENSION_WRITE_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.CONTINENTAL_ADMIN,
  UserRole.REC_ADMIN,
  UserRole.NATIONAL_ADMIN,
  UserRole.DATA_STEWARD,
];

const EXTENSION_PUBLISH_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.CONTINENTAL_ADMIN,
  UserRole.REC_ADMIN,
  UserRole.NATIONAL_ADMIN,
];

export default async function extensionRoutes(app: FastifyInstance): Promise<void> {
  const service = new ExtensionService(app.prisma, app.kafka.producer);

  let pubKey = (process.env['JWT_PUBLIC_KEY'] ?? '').replace(/\\n/g, '\n');
  if (!pubKey && process.env['JWT_PUBLIC_KEY_PATH']) {
    try { pubKey = readFileSync(process.env['JWT_PUBLIC_KEY_PATH'], 'utf8'); } catch { /* ignore */ }
  }
  const auth = authHook({ publicKey: pubKey });
  const tenant = tenantHook();

  // ── POST /api/v1/form-builder/forms/:baseFormId/extensions ──
  // Create a new extension for a base form (scoped to campaign + tenant)
  app.post<{ Params: BaseFormIdParam; Body: CreateExtensionBody }>(
    '/api/v1/form-builder/forms/:baseFormId/extensions',
    {
      schema: { params: BaseFormIdParamSchema, body: CreateExtensionBodySchema },
      preHandler: [auth, tenant, rolesHook(...EXTENSION_WRITE_ROLES)],
    },
    async (request, reply) => {
      const user = request.user as AuthenticatedUser;
      const result = await service.createExtension(
        request.params.baseFormId,
        request.body,
        user,
      );
      return reply.code(201).send(result);
    },
  );

  // ── GET /api/v1/form-builder/forms/:baseFormId/extensions?campaignId=&tenantId= ──
  // List extensions for a base form
  app.get<{ Params: BaseFormIdParam; Querystring: ListExtensionsQuery }>(
    '/api/v1/form-builder/forms/:baseFormId/extensions',
    {
      schema: { params: BaseFormIdParamSchema, querystring: ListExtensionsQuerySchema },
      preHandler: [auth, tenant],
    },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      return service.listExtensions(request.params.baseFormId, request.query, user);
    },
  );

  // ── GET /api/v1/form-builder/extensions/:id ──
  // Get a single extension with its fields
  app.get<{ Params: ExtensionIdParam }>(
    '/api/v1/form-builder/extensions/:id',
    {
      schema: { params: ExtensionIdParamSchema },
      preHandler: [auth, tenant],
    },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      return service.getExtension(request.params.id, user);
    },
  );

  // ── POST /api/v1/form-builder/extensions/:id/fields ──
  // Add a field to an extension (with conflict detection)
  app.post<{ Params: ExtensionIdParam; Body: AddExtensionFieldBody }>(
    '/api/v1/form-builder/extensions/:id/fields',
    {
      schema: { params: ExtensionIdParamSchema, body: AddExtensionFieldBodySchema },
      preHandler: [auth, tenant, rolesHook(...EXTENSION_WRITE_ROLES)],
    },
    async (request, reply) => {
      const user = request.user as AuthenticatedUser;
      const result = await service.addField(request.params.id, request.body, user);
      return reply.code(201).send(result);
    },
  );

  // ── PATCH /api/v1/form-builder/extensions/:id/fields/:fieldId ──
  // Update an extension field
  app.patch<{ Params: ExtensionFieldIdParam; Body: UpdateExtensionFieldBody }>(
    '/api/v1/form-builder/extensions/:id/fields/:fieldId',
    {
      schema: { params: ExtensionFieldIdParamSchema, body: UpdateExtensionFieldBodySchema },
      preHandler: [auth, tenant, rolesHook(...EXTENSION_WRITE_ROLES)],
    },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      return service.updateField(
        request.params.id,
        request.params.fieldId,
        request.body,
        user,
      );
    },
  );

  // ── DELETE /api/v1/form-builder/extensions/:id/fields/:fieldId ──
  // Delete an extension field
  app.delete<{ Params: ExtensionFieldIdParam }>(
    '/api/v1/form-builder/extensions/:id/fields/:fieldId',
    {
      schema: { params: ExtensionFieldIdParamSchema },
      preHandler: [auth, tenant, rolesHook(...EXTENSION_WRITE_ROLES)],
    },
    async (request, reply) => {
      const user = request.user as AuthenticatedUser;
      await service.deleteField(request.params.id, request.params.fieldId, user);
      return reply.code(204).send();
    },
  );

  // ── POST /api/v1/form-builder/extensions/:id/submit ──
  // Submit extension for validation (DRAFT → PENDING_VALIDATION)
  app.post<{ Params: ExtensionIdParam }>(
    '/api/v1/form-builder/extensions/:id/submit',
    {
      schema: { params: ExtensionIdParamSchema },
      preHandler: [auth, tenant, rolesHook(...EXTENSION_WRITE_ROLES)],
    },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      return service.submit(request.params.id, user);
    },
  );

  // ── POST /api/v1/form-builder/extensions/:id/publish ──
  // Publish extension (PENDING_VALIDATION → PUBLISHED)
  app.post<{ Params: ExtensionIdParam }>(
    '/api/v1/form-builder/extensions/:id/publish',
    {
      schema: { params: ExtensionIdParamSchema },
      preHandler: [auth, tenant, rolesHook(...EXTENSION_PUBLISH_ROLES)],
    },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      return service.publish(request.params.id, user);
    },
  );

  // ── GET /api/v1/form-builder/campaigns/:campaignId/forms/:baseFormId/effective?tenantId= ──
  // Get the effective form (base + published extension) for a campaign + tenant
  app.get<{ Params: EffectiveFormParam; Querystring: EffectiveFormQuery }>(
    '/api/v1/form-builder/campaigns/:campaignId/forms/:baseFormId/effective',
    {
      schema: { params: EffectiveFormParamSchema, querystring: EffectiveFormQuerySchema },
      preHandler: [auth, tenant],
    },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      return service.getEffectiveForm(
        request.params.campaignId,
        request.params.baseFormId,
        request.query.tenantId,
        user,
      );
    },
  );
}

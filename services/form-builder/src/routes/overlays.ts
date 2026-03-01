import type { FastifyInstance } from 'fastify';
import { UserRole } from '@aris/shared-types';
import { authHook, rolesHook, tenantHook } from '@aris/auth-middleware';
import type { AuthenticatedUser, AuthHookOptions } from '@aris/auth-middleware';
import { OverlayService } from '../services/overlay.service';
import {
  CreateOverlaySchema,
  UpdateOverlaySchema,
  OverlayIdParamSchema,
  TemplateIdParamSchema,
  ResolveTenantQuerySchema,
  PropagateBodySchema,
  ListOverlaysQuerySchema,
  HistoryQuerySchema,
} from '../schemas/overlay.schema';
import type {
  CreateOverlayBody,
  UpdateOverlayBody,
  OverlayIdParam,
  TemplateIdParam,
  ResolveTenantQuery,
  PropagateBody,
  ListOverlaysQuery,
  HistoryQuery,
} from '../schemas/overlay.schema';

const OVERLAY_WRITE_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.CONTINENTAL_ADMIN,
  UserRole.REC_ADMIN,
  UserRole.NATIONAL_ADMIN,
];

const PROPAGATE_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.CONTINENTAL_ADMIN,
];

export default async function overlayRoutes(app: FastifyInstance): Promise<void> {
  const service = new OverlayService(app.prisma, app.kafka.producer);

  const authOpts: AuthHookOptions = {
    publicKey: process.env['JWT_PUBLIC_KEY'] ?? '',
  };
  const auth = authHook(authOpts);
  const tenant = tenantHook();

  // ── POST /api/v1/form-builder/templates/:id/overlays ──
  app.post<{ Params: TemplateIdParam; Body: CreateOverlayBody }>(
    '/api/v1/form-builder/templates/:id/overlays',
    {
      schema: { params: TemplateIdParamSchema, body: CreateOverlaySchema },
      preHandler: [auth, tenant, rolesHook(...OVERLAY_WRITE_ROLES)],
    },
    async (request, reply) => {
      const user = request.user as AuthenticatedUser;
      const result = await service.createOverlay(request.params.id, request.body, user);
      return reply.code(201).send(result);
    },
  );

  // ── PUT /api/v1/form-builder/templates/:id/overlays/:overlayId ──
  app.put<{ Params: OverlayIdParam; Body: UpdateOverlayBody }>(
    '/api/v1/form-builder/templates/:id/overlays/:overlayId',
    {
      schema: { params: OverlayIdParamSchema, body: UpdateOverlaySchema },
      preHandler: [auth, tenant, rolesHook(...OVERLAY_WRITE_ROLES)],
    },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      return service.updateOverlay(
        request.params.id,
        request.params.overlayId,
        request.body,
        user,
      );
    },
  );

  // ── GET /api/v1/form-builder/templates/:id/overlays ──
  app.get<{ Params: TemplateIdParam; Querystring: ListOverlaysQuery }>(
    '/api/v1/form-builder/templates/:id/overlays',
    {
      schema: { params: TemplateIdParamSchema, querystring: ListOverlaysQuerySchema },
      preHandler: [auth, tenant],
    },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      return service.listOverlays(request.params.id, user, request.query);
    },
  );

  // ── GET /api/v1/form-builder/templates/:id/overlays/:overlayId ──
  app.get<{ Params: OverlayIdParam }>(
    '/api/v1/form-builder/templates/:id/overlays/:overlayId',
    {
      schema: { params: OverlayIdParamSchema },
      preHandler: [auth, tenant],
    },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      return service.getOverlay(request.params.id, request.params.overlayId, user);
    },
  );

  // ── DELETE /api/v1/form-builder/templates/:id/overlays/:overlayId ──
  app.delete<{ Params: OverlayIdParam }>(
    '/api/v1/form-builder/templates/:id/overlays/:overlayId',
    {
      schema: { params: OverlayIdParamSchema },
      preHandler: [auth, tenant, rolesHook(...OVERLAY_WRITE_ROLES)],
    },
    async (request, reply) => {
      const user = request.user as AuthenticatedUser;
      await service.deleteOverlay(request.params.id, request.params.overlayId, user);
      return reply.code(204).send();
    },
  );

  // ── GET /api/v1/form-builder/templates/:id/resolve ──
  app.get<{ Params: TemplateIdParam; Querystring: ResolveTenantQuery }>(
    '/api/v1/form-builder/templates/:id/resolve',
    {
      schema: { params: TemplateIdParamSchema, querystring: ResolveTenantQuerySchema },
      preHandler: [auth, tenant],
    },
    async (request) => {
      return service.resolveForm(request.params.id, request.query.tenantId);
    },
  );

  // ── GET /api/v1/form-builder/templates/:id/diff ──
  app.get<{ Params: TemplateIdParam; Querystring: ResolveTenantQuery }>(
    '/api/v1/form-builder/templates/:id/diff',
    {
      schema: { params: TemplateIdParamSchema, querystring: ResolveTenantQuerySchema },
      preHandler: [auth, tenant],
    },
    async (request) => {
      return service.computeDiff(request.params.id, request.query.tenantId);
    },
  );

  // ── POST /api/v1/form-builder/templates/:id/propagate ──
  app.post<{ Params: TemplateIdParam; Body: PropagateBody }>(
    '/api/v1/form-builder/templates/:id/propagate',
    {
      schema: { params: TemplateIdParamSchema, body: PropagateBodySchema },
      preHandler: [auth, tenant, rolesHook(...PROPAGATE_ROLES)],
    },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      return service.propagateBaseUpdate(
        request.params.id,
        request.body.modifiedFieldIds,
        user,
      );
    },
  );

  // ── GET /api/v1/form-builder/templates/:id/hierarchy ──
  app.get<{ Params: TemplateIdParam }>(
    '/api/v1/form-builder/templates/:id/hierarchy',
    {
      schema: { params: TemplateIdParamSchema },
      preHandler: [auth, tenant],
    },
    async (request) => {
      return service.getHierarchy(request.params.id);
    },
  );

  // ── GET /api/v1/form-builder/templates/:id/history ──
  app.get<{ Params: TemplateIdParam; Querystring: HistoryQuery }>(
    '/api/v1/form-builder/templates/:id/history',
    {
      schema: { params: TemplateIdParamSchema, querystring: HistoryQuerySchema },
      preHandler: [auth, tenant],
    },
    async (request) => {
      return service.getHistory(request.params.id, request.query);
    },
  );
}

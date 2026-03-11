import type { FastifyInstance } from 'fastify';
import {
  CreateRiskLayerSchema,
  UpdateRiskLayerSchema,
  RiskLayerBboxQuerySchema,
  RiskLayerListQuerySchema,
  type CreateRiskLayerInput,
  type UpdateRiskLayerInput,
  type RiskLayerBboxQueryInput,
  type RiskLayerListQueryInput,
} from '../schemas/risk-layer.schema';

interface AuthenticatedRequest {
  user?: { userId: string; tenantId: string };
}

export async function registerRiskLayerRoutes(app: FastifyInstance): Promise<void> {
  const authPreHandler = [app.authHookFn];

  // POST /api/v1/geo/risk-layers — Create risk layer
  app.post<{ Body: CreateRiskLayerInput }>(
    '/api/v1/geo/risk-layers',
    {
      schema: { body: CreateRiskLayerSchema },
      preHandler: authPreHandler,
    },
    async (request, reply) => {
      const { user } = request as AuthenticatedRequest;
      const tenantId = user?.tenantId ?? (request.headers['x-tenant-id'] as string);
      if (!tenantId) {
        return reply.code(400).send({ statusCode: 400, message: 'Missing tenantId' });
      }
      const result = await app.riskLayerService.create(request.body, tenantId, user?.userId);
      return reply.code(201).send({ data: result });
    },
  );

  // GET /api/v1/geo/risk-layers — List (paginated, filtered)
  app.get<{ Querystring: RiskLayerListQueryInput }>(
    '/api/v1/geo/risk-layers',
    {
      schema: { querystring: RiskLayerListQuerySchema },
      preHandler: authPreHandler,
    },
    async (request) => {
      const { user } = request as AuthenticatedRequest;
      const tenantId = user?.tenantId ?? (request.headers['x-tenant-id'] as string);
      return app.riskLayerService.findAll(tenantId, request.query);
    },
  );

  // GET /api/v1/geo/risk-layers/bbox — Query by bounding box
  app.get<{ Querystring: RiskLayerBboxQueryInput }>(
    '/api/v1/geo/risk-layers/bbox',
    {
      schema: { querystring: RiskLayerBboxQuerySchema },
      preHandler: authPreHandler,
    },
    async (request) => {
      const { user } = request as AuthenticatedRequest;
      const tenantId = user?.tenantId ?? (request.headers['x-tenant-id'] as string);
      const data = await app.riskLayerService.findByBbox(request.query, tenantId);
      return { data };
    },
  );

  // GET /api/v1/geo/risk-layers/:id — Get by ID
  app.get<{ Params: { id: string } }>(
    '/api/v1/geo/risk-layers/:id',
    { preHandler: authPreHandler },
    async (request) => {
      const { user } = request as AuthenticatedRequest;
      const tenantId = user?.tenantId ?? (request.headers['x-tenant-id'] as string);
      const data = await app.riskLayerService.findById(request.params.id, tenantId);
      return { data };
    },
  );

  // PUT /api/v1/geo/risk-layers/:id — Update
  app.put<{ Params: { id: string }; Body: UpdateRiskLayerInput }>(
    '/api/v1/geo/risk-layers/:id',
    {
      schema: { body: UpdateRiskLayerSchema },
      preHandler: authPreHandler,
    },
    async (request) => {
      const { user } = request as AuthenticatedRequest;
      const tenantId = user?.tenantId ?? (request.headers['x-tenant-id'] as string);
      const data = await app.riskLayerService.update(
        request.params.id,
        request.body,
        tenantId,
        user?.userId,
      );
      return { data };
    },
  );

  // DELETE /api/v1/geo/risk-layers/:id — Soft delete
  app.delete<{ Params: { id: string } }>(
    '/api/v1/geo/risk-layers/:id',
    { preHandler: authPreHandler },
    async (request, reply) => {
      const { user } = request as AuthenticatedRequest;
      const tenantId = user?.tenantId ?? (request.headers['x-tenant-id'] as string);
      await app.riskLayerService.delete(request.params.id, tenantId, user?.userId);
      return reply.code(204).send();
    },
  );
}

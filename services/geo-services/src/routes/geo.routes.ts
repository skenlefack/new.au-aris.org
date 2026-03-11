import type { FastifyInstance } from 'fastify';
import {
  WithinQuerySchema,
  NearestQuerySchema,
  ContainsQuerySchema,
  RiskMapQuerySchema,
  SpatialAnalysisQuerySchema,
  TileParamsSchema,
  type WithinQueryInput,
  type NearestQueryInput,
  type ContainsQueryInput,
  type RiskMapQueryInput,
  type SpatialAnalysisQueryInput,
  type TileParamsInput,
} from '../schemas/geo.schema';

export async function registerGeoRoutes(app: FastifyInstance): Promise<void> {
  const authPreHandler = [app.authHookFn];

  // GET /api/v1/geo/layers
  app.get(
    '/api/v1/geo/layers',
    { preHandler: authPreHandler },
    async () => {
      return app.geoService.listLayers();
    },
  );

  // GET /api/v1/geo/query/within
  app.get<{ Querystring: WithinQueryInput }>(
    '/api/v1/geo/query/within',
    {
      schema: { querystring: WithinQuerySchema },
      preHandler: authPreHandler,
    },
    async (request) => {
      return app.geoService.queryWithin(request.query);
    },
  );

  // GET /api/v1/geo/query/nearest
  app.get<{ Querystring: NearestQueryInput }>(
    '/api/v1/geo/query/nearest',
    {
      schema: { querystring: NearestQuerySchema },
      preHandler: authPreHandler,
    },
    async (request) => {
      return app.geoService.queryNearest(request.query);
    },
  );

  // GET /api/v1/geo/query/contains
  app.get<{ Querystring: ContainsQueryInput }>(
    '/api/v1/geo/query/contains',
    {
      schema: { querystring: ContainsQuerySchema },
      preHandler: authPreHandler,
    },
    async (request) => {
      return app.geoService.queryContains(request.query);
    },
  );

  // GET /api/v1/geo/risk-map
  app.get<{ Querystring: RiskMapQueryInput }>(
    '/api/v1/geo/risk-map',
    {
      schema: { querystring: RiskMapQuerySchema },
      preHandler: authPreHandler,
    },
    async (request) => {
      return app.geoService.getRiskMap(request.query);
    },
  );

  // GET /api/v1/geo/admin-boundaries/:code
  app.get<{ Params: { code: string } }>(
    '/api/v1/geo/admin-boundaries/:code',
    { preHandler: authPreHandler },
    async (request) => {
      return app.geoService.getAdminBoundary(request.params.code);
    },
  );

  // POST /api/v1/geo/spatial-analysis
  app.post<{ Body: SpatialAnalysisQueryInput }>(
    '/api/v1/geo/spatial-analysis',
    {
      schema: { body: SpatialAnalysisQuerySchema },
      preHandler: authPreHandler,
    },
    async (request) => {
      const user = (request as any).user;
      const tenantId = user?.tenantId ?? (request.headers['x-tenant-id'] as string);
      return app.geoService.spatialAnalysis({
        point: request.body.point,
        radiusKm: request.body.radiusKm,
        tenantId,
        layerTypes: request.body.layerTypes,
      });
    },
  );

  // GET /api/v1/geo/tiles/:layer/:z/:x/:y.pbf — Vector tile proxy to pg_tileserv
  app.get<{ Params: { layer: string; z: string; x: string; y: string } }>(
    '/api/v1/geo/tiles/:layer/:z/:x/:y.pbf',
    { preHandler: authPreHandler },
    async (request, reply) => {
      const { layer, z, x, y } = request.params;
      const cacheKey = `aris:geo:tile:${layer}:${z}:${x}:${y}`;

      // Check Redis cache
      try {
        const cached = await app.redis.getBuffer(cacheKey);
        if (cached) {
          return reply
            .header('Content-Type', 'application/x-protobuf')
            .header('Content-Encoding', 'gzip')
            .header('X-Cache', 'HIT')
            .send(cached);
        }
      } catch { /* cache miss */ }

      // Proxy to pg_tileserv
      const tileservUrl = process.env['PG_TILESERV_URL'] ?? 'http://pg-tileserv:7800';
      const url = `${tileservUrl}/${layer}/${z}/${x}/${y}.pbf`;

      try {
        const response = await fetch(url);
        if (!response.ok) {
          return reply.code(response.status).send({
            statusCode: response.status,
            message: `Tile not found: ${layer}/${z}/${x}/${y}`,
          });
        }

        const buffer = Buffer.from(await response.arrayBuffer());

        // Cache for 1 hour
        try {
          await app.redis.set(cacheKey, buffer, 'EX', 3600);
        } catch { /* cache write failure is non-fatal */ }

        return reply
          .header('Content-Type', 'application/x-protobuf')
          .header('X-Cache', 'MISS')
          .send(buffer);
      } catch (error) {
        request.log.error(error, 'Failed to fetch tile from pg_tileserv');
        return reply.code(502).send({
          statusCode: 502,
          message: 'Tile server unavailable',
        });
      }
    },
  );
}

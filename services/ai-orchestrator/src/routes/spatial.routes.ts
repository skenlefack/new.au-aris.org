/**
 * Router 5: /api/v1/ai/spatial
 * Spatial analysis endpoints proxying to Python ML service.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { AuthenticatedUser } from '@aris/auth-middleware';

const PREFIX = '/api/v1/ai/spatial';

interface ClusterBody {
  points: Array<{ lat: number; lng: number; weight?: number; metadata?: Record<string, unknown> }>;
  algorithm?: 'kmeans' | 'dbscan' | 'hdbscan';
  numClusters?: number;
  eps?: number;
}

interface HotspotBody {
  points: Array<{ lat: number; lng: number; value: number; metadata?: Record<string, unknown> }>;
  radius?: number;
  minPoints?: number;
}

export async function registerSpatialRoutes(app: FastifyInstance): Promise<void> {

  // ── POST /clusters ──
  app.post(`${PREFIX}/clusters`, {
    preHandler: [app.authHookFn, app.rateLimitHook],
  }, async (request: FastifyRequest<{ Body: ClusterBody }>, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const { points, algorithm, numClusters, eps } = request.body;

    const start = Date.now();
    const result = await app.mlClient.clusterSpatial({ points, algorithm, numClusters, eps });

    await app.usageLogger.log({
      userId: user.userId, endpoint: `${PREFIX}/clusters`, model: `spatial-${algorithm ?? 'kmeans'}`,
      tokensInput: 0, tokensOutput: 0,
      durationMs: Date.now() - start, status: 'success', timestamp: Date.now(),
    });

    return reply.code(200).send({ data: result });
  });

  // ── POST /hotspots ──
  app.post(`${PREFIX}/hotspots`, {
    preHandler: [app.authHookFn, app.rateLimitHook],
  }, async (request: FastifyRequest<{ Body: HotspotBody }>, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const { points, radius, minPoints } = request.body;

    const start = Date.now();

    // Hotspot detection uses clustering + density analysis
    // Transform hotspot points into cluster input
    const clusterPoints = points.map((p) => ({
      lat: p.lat,
      lng: p.lng,
      weight: p.value,
      metadata: p.metadata,
    }));

    const clusterResult = await app.mlClient.clusterSpatial({
      points: clusterPoints,
      algorithm: 'dbscan',
      eps: radius ?? 0.5,
    });

    // Enrich clusters with hotspot scoring
    const hotspots = clusterResult.clusters
      .filter((c) => c.size >= (minPoints ?? 3))
      .map((c) => ({
        id: c.id,
        centroid: c.centroid,
        size: c.size,
        intensity: c.size / (clusterResult.clusters.length || 1),
        pointIndices: c.points,
      }))
      .sort((a, b) => b.intensity - a.intensity);

    await app.usageLogger.log({
      userId: user.userId, endpoint: `${PREFIX}/hotspots`, model: 'spatial-hotspot',
      tokensInput: 0, tokensOutput: 0,
      durationMs: Date.now() - start, status: 'success', timestamp: Date.now(),
    });

    return reply.code(200).send({
      data: {
        hotspots,
        totalPoints: points.length,
        durationMs: Date.now() - start,
      },
    });
  });
}

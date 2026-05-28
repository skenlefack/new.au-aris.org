/**
 * ARIS 4.0 — Model Versioning & A/B Testing Routes
 * Manage ML model versions and traffic-split experiments.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { AuthenticatedUser } from '@aris/auth-middleware';

const ADMIN_ROLES = ['SUPER_ADMIN', 'CONTINENTAL_ADMIN'];

function requireAdmin(user: AuthenticatedUser): void {
  if (!ADMIN_ROLES.includes(user.role)) {
    throw Object.assign(new Error('Admin access required'), { statusCode: 403 });
  }
}

interface VersionParams { modelId: string }
interface VersionPromoteParams { modelId: string; versionId: string }
interface AbTestParams { id: string }

interface CreateAbTestBody {
  name: string;
  modelId: string;
  versionAId: string;
  versionBId: string;
  trafficSplit?: number;
}

interface UpdateAbTestBody {
  status?: 'RUNNING' | 'COMPLETED' | 'CANCELLED';
  trafficSplit?: number;
}

export async function registerModelVersionRoutes(app: FastifyInstance): Promise<void> {
  const db = app.prisma;

  // ── List versions for a model ─────────────────────────────
  app.get('/api/v1/ai/models/:modelId/versions', {
    preHandler: [app.authHookFn],
  }, async (request: FastifyRequest<{ Params: VersionParams }>, reply: FastifyReply) => {
    const versions = await db.mlModelVersion.findMany({
      where: { modelId: request.params.modelId },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send({ data: versions });
  });

  // ── Promote a version (make it active) ────────────────────
  app.post('/api/v1/ai/models/:modelId/versions/:versionId/promote', {
    preHandler: [app.authHookFn, app.rateLimitHook],
  }, async (request: FastifyRequest<{ Params: VersionPromoteParams }>, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    requireAdmin(user);

    const { modelId, versionId } = request.params;

    // Deactivate all versions for this model
    await db.mlModelVersion.updateMany({
      where: { modelId, isActive: true },
      data: { isActive: false, trafficWeight: 0 },
    });

    // Activate the selected version
    const promoted = await db.mlModelVersion.update({
      where: { id: versionId },
      data: { isActive: true, trafficWeight: 1.0 },
    });

    return reply.send({ data: promoted });
  });

  // ── Create A/B test ───────────────────────────────────────
  app.post('/api/v1/ai/models/ab-tests', {
    preHandler: [app.authHookFn, app.rateLimitHook],
  }, async (request: FastifyRequest<{ Body: CreateAbTestBody }>, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    requireAdmin(user);

    const { name, modelId, versionAId, versionBId, trafficSplit } = request.body;

    const test = await db.mlAbTest.create({
      data: {
        name,
        modelId,
        versionAId,
        versionBId,
        trafficSplit: trafficSplit ?? 0.5,
        status: 'DRAFT',
      },
      include: { versionA: true, versionB: true },
    });

    return reply.code(201).send({ data: test });
  });

  // ── List A/B tests ────────────────────────────────────────
  app.get('/api/v1/ai/models/ab-tests', {
    preHandler: [app.authHookFn],
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const tests = await db.mlAbTest.findMany({
      orderBy: { createdAt: 'desc' },
      include: { versionA: true, versionB: true },
    });
    return reply.send({ data: tests });
  });

  // ── Get A/B test results ──────────────────────────────────
  app.get('/api/v1/ai/models/ab-tests/:id/results', {
    preHandler: [app.authHookFn],
  }, async (request: FastifyRequest<{ Params: AbTestParams }>, reply: FastifyReply) => {
    const test = await db.mlAbTest.findUnique({
      where: { id: request.params.id },
      include: { versionA: true, versionB: true },
    });

    if (!test) {
      return reply.code(404).send({ statusCode: 404, message: 'A/B test not found' });
    }

    return reply.send({
      data: {
        ...test,
        summary: {
          totalRequests: test.totalRequestsA + test.totalRequestsB,
          versionA: {
            requests: test.totalRequestsA,
            metrics: test.metricsA,
            trafficShare: test.trafficSplit,
          },
          versionB: {
            requests: test.totalRequestsB,
            metrics: test.metricsB,
            trafficShare: 1 - test.trafficSplit,
          },
        },
      },
    });
  });

  // ── Update A/B test (start, stop, change split) ───────────
  app.patch('/api/v1/ai/models/ab-tests/:id', {
    preHandler: [app.authHookFn, app.rateLimitHook],
  }, async (request: FastifyRequest<{ Params: AbTestParams; Body: UpdateAbTestBody }>, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    requireAdmin(user);

    const { status, trafficSplit } = request.body;
    const updateData: Record<string, unknown> = {};

    if (status) {
      updateData.status = status;
      if (status === 'RUNNING') updateData.startDate = new Date();
      if (status === 'COMPLETED' || status === 'CANCELLED') updateData.endDate = new Date();
    }
    if (trafficSplit !== undefined) {
      updateData.trafficSplit = Math.max(0, Math.min(1, trafficSplit));
    }

    const updated = await db.mlAbTest.update({
      where: { id: request.params.id },
      data: updateData,
      include: { versionA: true, versionB: true },
    });

    return reply.send({ data: updated });
  });
}

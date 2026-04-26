/**
 * Router 3: /api/v1/ai/predictions
 * Prediction endpoints proxying to Python ML service.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { TOPIC_AI_PREDICTION_COMPLETED } from '@aris/shared-types';

const PREFIX = '/api/v1/ai/predictions';

interface EpidemicBody {
  disease?: string;
  country?: string;
  region?: string;
  features: Record<string, unknown>;
  horizon?: number;
  model?: string;
}

interface ProductionBody {
  species?: string;
  country?: string;
  features: Record<string, unknown>;
  horizon?: number;
  model?: string;
}

export async function registerPredictionRoutes(app: FastifyInstance): Promise<void> {

  // ── POST /epidemic ──
  app.post(`${PREFIX}/epidemic`, {
    preHandler: [app.authHookFn, app.rateLimitHook],
  }, async (request: FastifyRequest<{ Body: EpidemicBody }>, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const { features, horizon, model } = request.body;

    const start = Date.now();
    const result = await app.mlClient.predictEpidemic({ features, horizon, model });

    await app.usageLogger.log({
      userId: user.userId, endpoint: `${PREFIX}/epidemic`, model: result.model ?? 'epidemic-ml',
      tokensInput: 0, tokensOutput: 0,
      durationMs: Date.now() - start, status: 'success', timestamp: Date.now(),
    });

    await publishKafka(app, TOPIC_AI_PREDICTION_COMPLETED, {
      userId: user.userId, type: 'epidemic', model: result.model,
    });

    return reply.code(200).send({ data: result });
  });

  // ── POST /production ──
  app.post(`${PREFIX}/production`, {
    preHandler: [app.authHookFn, app.rateLimitHook],
  }, async (request: FastifyRequest<{ Body: ProductionBody }>, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const { features, horizon, model } = request.body;

    const start = Date.now();
    const result = await app.mlClient.predictProduction({ features, horizon, model });

    await app.usageLogger.log({
      userId: user.userId, endpoint: `${PREFIX}/production`, model: result.model ?? 'production-ml',
      tokensInput: 0, tokensOutput: 0,
      durationMs: Date.now() - start, status: 'success', timestamp: Date.now(),
    });

    await publishKafka(app, TOPIC_AI_PREDICTION_COMPLETED, {
      userId: user.userId, type: 'production', model: result.model,
    });

    return reply.code(200).send({ data: result });
  });

  // ── GET /models ──
  app.get(`${PREFIX}/models`, {
    preHandler: [app.authHookFn],
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const models = await app.mlClient.listModels();
    const predictionModels = models.filter((m) => m.type === 'prediction' || m.type === 'forecast');
    return reply.code(200).send({ data: predictionModels });
  });
}

// ── Kafka helper ──

async function publishKafka(app: FastifyInstance, topic: string, payload: unknown): Promise<void> {
  try {
    await Promise.race([
      app.kafka.producer.send({
        topic,
        messages: [{ value: JSON.stringify(payload) }],
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Kafka publish timeout')), 5000)),
    ]);
  } catch {
    app.log.warn(`Failed to publish to ${topic}`);
  }
}

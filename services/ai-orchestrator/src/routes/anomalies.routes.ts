/**
 * Router 4: /api/v1/ai/anomalies
 * Anomaly detection endpoints proxying to Python ML service.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { TOPIC_AI_ANOMALY_DETECTED } from '@aris/shared-types';

const PREFIX = '/api/v1/ai/anomalies';

interface DetectBody {
  data: Record<string, unknown>[];
  method?: 'isolation_forest' | 'dbscan' | 'zscore';
  threshold?: number;
}

interface SubmissionAnalysisBody {
  submissionIds?: string[];
  domain?: string;
  since?: string;
  limit?: number;
}

export async function registerAnomalyRoutes(app: FastifyInstance): Promise<void> {

  // ── POST /detect ──
  app.post(`${PREFIX}/detect`, {
    preHandler: [app.authHookFn, app.rateLimitHook],
  }, async (request: FastifyRequest<{ Body: DetectBody }>, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const { data, method, threshold } = request.body;

    const start = Date.now();
    const result = await app.mlClient.detectAnomalies({ data, method, threshold });

    await app.usageLogger.log({
      userId: user.userId, endpoint: `${PREFIX}/detect`, model: `anomaly-${method ?? 'isolation_forest'}`,
      tokensInput: 0, tokensOutput: 0,
      durationMs: Date.now() - start, status: 'success', timestamp: Date.now(),
    });

    // Publish Kafka event if anomalies were found
    if (result.anomalyCount > 0) {
      await publishKafka(app, TOPIC_AI_ANOMALY_DETECTED, {
        userId: user.userId, anomalyCount: result.anomalyCount,
        method: method ?? 'isolation_forest', totalChecked: result.totalChecked,
      });
    }

    return reply.code(200).send({ data: result });
  });

  // ── POST /submissions ──
  app.post(`${PREFIX}/submissions`, {
    preHandler: [app.authHookFn, app.rateLimitHook],
  }, async (request: FastifyRequest<{ Body: SubmissionAnalysisBody }>, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const { domain, since, limit } = request.body;

    // This endpoint would normally fetch recent submissions from the collecte service
    // and run anomaly detection on them. For now, we describe the capability.
    const start = Date.now();

    // Placeholder: in production this would query the collecte DB or API
    const response = {
      message: 'Submission anomaly analysis',
      domain: domain ?? 'all',
      since: since ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      limit: limit ?? 100,
      status: 'not_yet_connected',
      hint: 'Connect to collecte service submission data for live analysis',
    };

    await app.usageLogger.log({
      userId: user.userId, endpoint: `${PREFIX}/submissions`, model: 'anomaly-submissions',
      tokensInput: 0, tokensOutput: 0,
      durationMs: Date.now() - start, status: 'success', timestamp: Date.now(),
    });

    return reply.code(200).send({ data: response });
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

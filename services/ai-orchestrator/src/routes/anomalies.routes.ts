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
  campaignId?: string;
  sensitivity?: number;
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
    const { domain, since, limit, campaignId, sensitivity } = request.body;

    const start = Date.now();

    // Extract JWT token from Authorization header for downstream call
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return reply.code(401).send({ statusCode: 401, message: 'Missing authorization header' });
    }
    const token = authHeader.replace(/^Bearer\s+/i, '');

    // 1. Fetch submissions from collecte service
    const defaultSince = since ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    let submissions;
    try {
      submissions = await app.collecteClient.fetchSubmissions(token, {
        domain,
        since: defaultSince,
        limit: limit ?? 200,
        campaignId,
      });
    } catch (err) {
      request.log.error(err, 'Failed to fetch submissions from collecte service');
      return reply.code(502).send({
        statusCode: 502,
        message: `Failed to fetch submissions: ${err instanceof Error ? err.message : 'unknown error'}`,
      });
    }

    if (!submissions || submissions.length === 0) {
      return reply.code(200).send({
        data: {
          results: [],
          total_submissions: 0,
          anomaly_count: 0,
          durationMs: Date.now() - start,
        },
      });
    }

    // 2. Map submissions to {id, data} format for ML service
    const mlPayload = submissions.map((s) => ({
      id: s.id,
      data: s.data ?? {},
    }));

    // 3. Send to ML service for anomaly analysis
    let mlResult;
    try {
      mlResult = await app.mlClient.analyzeSubmissions({
        submissions: mlPayload,
        sensitivity: sensitivity ?? 0.1,
      });
    } catch (err) {
      request.log.error(err, 'ML submission analysis failed');
      return reply.code(502).send({
        statusCode: 502,
        message: `ML analysis failed: ${err instanceof Error ? err.message : 'unknown error'}`,
      });
    }

    // 4. Log usage
    await app.usageLogger.log({
      userId: user.userId, endpoint: `${PREFIX}/submissions`, model: 'anomaly-submissions',
      tokensInput: 0, tokensOutput: 0,
      durationMs: Date.now() - start, status: 'success', timestamp: Date.now(),
    });

    // 5. Publish Kafka event if anomalies found
    if (mlResult.anomaly_count > 0) {
      await publishKafka(app, TOPIC_AI_ANOMALY_DETECTED, {
        userId: user.userId,
        anomalyCount: mlResult.anomaly_count,
        method: 'isolation_forest',
        totalChecked: mlResult.total_submissions,
        domain: domain ?? 'all',
        source: 'submissions',
        anomalousSubmissionIds: mlResult.results
          .filter((r) => r.is_anomaly)
          .map((r) => r.submission_id),
      });
    }

    return reply.code(200).send({ data: mlResult });
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

import type { FastifyInstance } from 'fastify';

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /api/v1/ai/health — global health (Ollama + ML + models) ──
  app.get('/api/v1/ai/health', async () => {
    const [ollamaOk, mlOk] = await Promise.all([
      app.ollamaClient.healthCheck(),
      app.mlClient.healthCheck(),
    ]);

    const ollamaModels = ollamaOk ? await app.ollamaClient.listModels() : [];
    const mlModels = mlOk ? await app.mlClient.listModels() : [];

    return {
      data: {
        status: ollamaOk && mlOk ? 'ok' : ollamaOk || mlOk ? 'degraded' : 'down',
        ollama: {
          connected: ollamaOk,
          status: ollamaOk ? 'up' : 'down',
          url: app.ollamaClient.getBaseUrl(),
          models: ollamaModels.map((m) => m.name),
        },
        ml: {
          connected: mlOk,
          status: mlOk ? 'up' : 'down',
          url: app.mlClient.getBaseUrl(),
          models: mlModels.map((m) => ({ name: m.name, type: m.type, status: m.status })),
        },
        timestamp: new Date().toISOString(),
      },
    };
  });

  // ── GET /api/v1/ai/models — list all AI models ──
  app.get('/api/v1/ai/models', {
    preHandler: [app.authHookFn],
  }, async () => {
    const [ollamaModels, mlModels] = await Promise.all([
      app.ollamaClient.listModels(),
      app.mlClient.listModels(),
    ]);

    return {
      data: {
        ollama: ollamaModels.map((m) => ({
          name: m.name,
          size: m.size,
          modified_at: m.modified_at,
          provider: 'ollama' as const,
        })),
        ml: mlModels.map((m) => ({
          name: m.name,
          type: m.type,
          version: m.version,
          status: m.status,
          provider: 'ml' as const,
        })),
      },
    };
  });

  // ── GET /api/v1/ai/usage — usage statistics ──
  app.get('/api/v1/ai/usage', {
    preHandler: [app.authHookFn],
  }, async () => {
    const stats = await app.usageLogger.getUsageStats();
    return { data: stats };
  });
}

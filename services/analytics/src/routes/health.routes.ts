import type { FastifyInstance } from 'fastify';

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => {
    return { status: 'ok', service: 'analytics', timestamp: new Date().toISOString() };
  });

  // Force-restart (called by kafka-health monitoring)
  app.post('/admin/force-restart', async (_request, reply) => {
    reply.send({ status: 'restarting' });
    setTimeout(() => process.exit(1), 500);
  });
}

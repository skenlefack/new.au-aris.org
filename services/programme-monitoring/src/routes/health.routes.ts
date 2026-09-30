import type { FastifyInstance } from 'fastify';

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => {
    return { status: 'ok', service: 'programme-monitoring', timestamp: new Date().toISOString() };
  });
}

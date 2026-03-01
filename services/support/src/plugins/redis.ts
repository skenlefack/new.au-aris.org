import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import Redis from 'ioredis';

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis;
  }
}

export default fp(
  async (app: FastifyInstance) => {
    const redis = new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379', {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
    });
    await redis.connect();
    app.log.info('Redis connected');

    app.decorate('redis', redis);

    app.addHook('onClose', async () => {
      await redis.quit();
      app.log.info('Redis disconnected');
    });
  },
  { name: 'redis' },
);

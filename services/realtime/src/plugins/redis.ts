import fp from 'fastify-plugin';
import Redis from 'ioredis';

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis;
  }
}

export default fp(async (app) => {
  const redis = new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379', {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
  });
  await redis.connect();
  app.log.info('Redis connected (realtime)');
  app.decorate('redis', redis);
  app.addHook('onClose', async () => {
    await redis.quit();
  });
}, { name: 'redis-plugin' });

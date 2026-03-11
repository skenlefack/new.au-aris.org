import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import Redis from 'ioredis';

export default fp(
  async (app: FastifyInstance) => {
    const redisUrl = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
    const redis = new Redis(redisUrl);

    redis.on('error', (err) => {
      app.log.error(err, 'Redis connection error');
    });

    redis.on('connect', () => {
      app.log.info('Redis connected');
    });

    app.decorate('redis', redis);

    app.addHook('onClose', async () => {
      await redis.quit();
      app.log.info('Redis disconnected');
    });
  },
  { name: 'redis' },
);

import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

export default fp(
  async (app: FastifyInstance) => {
    const prisma = new PrismaClient();
    await prisma.$connect();
    await prisma.$queryRawUnsafe('SELECT 1');
    app.log.info('Prisma connected to database (pool primed)');

    app.decorate('prisma', prisma);

    app.addHook('onClose', async () => {
      await prisma.$disconnect();
      app.log.info('Prisma disconnected from database');
    });
  },
  { name: 'prisma' },
);

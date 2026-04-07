import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';

export default fp(
  async (app: FastifyInstance) => {
    const prisma = new PrismaClient();
    await prisma.$connect();
    app.log.info('Prisma connected to database');

    app.decorate('prisma', prisma);

    app.addHook('onClose', async () => {
      await prisma.$disconnect();
      app.log.info('Prisma disconnected from database');
    });
  },
  { name: 'prisma' },
);

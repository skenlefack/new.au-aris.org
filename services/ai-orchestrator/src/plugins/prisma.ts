/**
 * ARIS 4.0 — Prisma plugin for AI Orchestrator.
 * Provides database access for chat history, model versions, and A/B tests.
 */

import fp from 'fastify-plugin';
import { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

export default fp(async (app: FastifyInstance) => {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env['DATABASE_URL'],
      },
    },
    log: process.env['NODE_ENV'] !== 'production'
      ? ['warn', 'error']
      : ['error'],
  });

  await prisma.$connect();

  app.decorate('prisma', prisma);

  app.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
});

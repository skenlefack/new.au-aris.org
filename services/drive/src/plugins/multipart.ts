import fp from 'fastify-plugin';
import multipart from '@fastify/multipart';
import type { FastifyInstance } from 'fastify';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

export default fp(
  async (app: FastifyInstance) => {
    await app.register(multipart, {
      limits: {
        fileSize: MAX_FILE_SIZE,
      },
    });
    app.log.info(`Multipart plugin registered (max file size: ${MAX_FILE_SIZE / 1024 / 1024} MB)`);
  },
  { name: 'multipart' },
);

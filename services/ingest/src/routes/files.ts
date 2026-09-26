import type { FastifyInstance } from 'fastify';
import { tenantHook, rolesHook } from '@aris/auth-middleware/fastify';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { UserRole } from '@aris/shared-types';
import { FileService } from '../services/file.service';

export async function registerFileRoutes(app: FastifyInstance): Promise<void> {
  const fileService = new FileService(app.prisma, app.kafka as any, app.minio, app.redis);
  const auth = app.authHookFn;
  const tenant = tenantHook();

  // POST /api/v1/ingest/files — Upload file (multipart)
  app.post('/api/v1/ingest/files', {
    preHandler: [auth, tenant],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const data = await request.file();
    if (!data) {
      return reply.code(400).send({ statusCode: 400, message: 'No file provided' });
    }
    const query = request.query as { domain?: string };
    const result = await fileService.upload(data, user, query.domain);
    return reply.code(201).send(result);
  });

  // GET /api/v1/ingest/files — List files (paginated, tenant-scoped)
  app.get('/api/v1/ingest/files', {
    preHandler: [auth, tenant],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    const query = request.query as { page?: string; limit?: string; status?: string };
    return fileService.list(user, {
      page: parseInt(query.page ?? '1', 10),
      limit: parseInt(query.limit ?? '20', 10),
      status: query.status,
    });
  });

  // GET /api/v1/ingest/files/:id — File detail + status
  app.get('/api/v1/ingest/files/:id', {
    preHandler: [auth, tenant],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    const { id } = request.params as { id: string };
    return fileService.getById(id, user);
  });

  // GET /api/v1/ingest/files/:id/profile — Structural + semantic profile
  app.get('/api/v1/ingest/files/:id/profile', {
    preHandler: [auth, tenant],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    const { id } = request.params as { id: string };
    return fileService.getProfile(id, user);
  });

  // GET /api/v1/ingest/files/:id/proposals — Ranked match proposals
  app.get('/api/v1/ingest/files/:id/proposals', {
    preHandler: [auth, tenant],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    const { id } = request.params as { id: string };
    return fileService.getProposals(id, user);
  });

  // POST /api/v1/ingest/files/:id/mapping — Confirm or correct mapping
  app.post('/api/v1/ingest/files/:id/mapping', {
    preHandler: [auth, tenant],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    const { id } = request.params as { id: string };
    return fileService.confirmMapping(id, request.body as Record<string, unknown>, user);
  });

  // POST /api/v1/ingest/files/:id/campaign — Choose or create campaign
  app.post('/api/v1/ingest/files/:id/campaign', {
    preHandler: [auth, tenant],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    const { id } = request.params as { id: string };
    return fileService.resolveCampaign(id, request.body as Record<string, unknown>, user);
  });

  // POST /api/v1/ingest/files/:id/dry-run — Simulation
  app.post('/api/v1/ingest/files/:id/dry-run', {
    preHandler: [auth, tenant],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    const { id } = request.params as { id: string };
    return fileService.dryRun(id, user);
  });

  // GET /api/v1/ingest/files/:id/quality-report — Quality report from dry-run
  app.get('/api/v1/ingest/files/:id/quality-report', {
    preHandler: [auth, tenant],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    const { id } = request.params as { id: string };
    return fileService.getQualityReport(id, user);
  });

  // POST /api/v1/ingest/files/:id/commit — Effective loading
  app.post('/api/v1/ingest/files/:id/commit', {
    preHandler: [auth, tenant],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    const { id } = request.params as { id: string };
    return fileService.commit(id, user);
  });

  // POST /api/v1/ingest/files/:id/cancel — Cancel and purge
  app.post('/api/v1/ingest/files/:id/cancel', {
    preHandler: [auth, tenant],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    const { id } = request.params as { id: string };
    return fileService.cancel(id, user);
  });
}

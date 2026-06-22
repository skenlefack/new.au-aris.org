import type { FastifyInstance } from 'fastify';
import { tenantHook } from '@aris/auth-middleware';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { SubmissionService } from '../services/submission.service';
import {
  CreateSubmissionSchema,
  ListSubmissionsQuerySchema,
  IdParamSchema,
  UpdateStatusSchema,
  UpdateDataSchema,
  ResolveConflictSchema,
} from '../schemas/submission.schema';
import type {
  CreateSubmissionBody,
  ListSubmissionsQuery,
  IdParam,
  UpdateStatusBody,
  UpdateDataBody,
  ResolveConflictBody,
} from '../schemas/submission.schema';

export default async function submissionRoutes(app: FastifyInstance): Promise<void> {
  const service = new SubmissionService(app.prisma, app.kafka.producer, app.kafka);

  const auth = app.authHookFn;
  const tenant = tenantHook();

  // Set up Kafka event consumers AFTER server is ready (non-blocking)
  // This avoids Fastify plugin timeout when Kafka broker is slow to respond
  app.addHook('onReady', async () => {
    service.setupEventConsumers().catch((err) => {
      app.log.warn(`Kafka event consumers setup failed: ${err instanceof Error ? err.message : String(err)}`);
    });
  });

  // POST /api/v1/collecte/submissions
  app.post<{ Body: CreateSubmissionBody }>('/api/v1/collecte/submissions', {
    schema: { body: CreateSubmissionSchema },
    preHandler: [auth, tenant],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await service.submit(request.body, user);
    return reply.code(201).send(result);
  });

  // GET /api/v1/collecte/submissions
  app.get<{ Querystring: ListSubmissionsQuery }>('/api/v1/collecte/submissions', {
    schema: { querystring: ListSubmissionsQuerySchema },
    preHandler: [auth, tenant],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return service.findAll(user, {
      ...request.query,
      campaignId: request.query.campaign,
    });
  });

  // GET /api/v1/collecte/submissions/conflicts — List submissions with pending conflicts
  // (registered before /:id to ensure static path takes priority)
  app.get<{ Querystring: ListSubmissionsQuery }>('/api/v1/collecte/submissions/conflicts', {
    schema: { querystring: ListSubmissionsQuerySchema },
    preHandler: [auth, tenant],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return service.findConflicts(user, request.query);
  });

  // GET /api/v1/collecte/submissions/:id
  app.get<{ Params: IdParam }>('/api/v1/collecte/submissions/:id', {
    schema: { params: IdParamSchema },
    preHandler: [auth, tenant],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return service.findOne(request.params.id, user);
  });

  // PATCH /api/v1/collecte/submissions/:id/status
  app.patch<{ Params: IdParam; Body: UpdateStatusBody }>('/api/v1/collecte/submissions/:id/status', {
    schema: { params: IdParamSchema, body: UpdateStatusSchema },
    preHandler: [auth, tenant],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return service.updateStatus(request.params.id, request.body, user);
  });

  // PATCH /api/v1/collecte/submissions/:id/data — Correction & resubmission
  app.patch<{ Params: IdParam; Body: UpdateDataBody }>('/api/v1/collecte/submissions/:id/data', {
    schema: { params: IdParamSchema, body: UpdateDataSchema },
    preHandler: [auth, tenant],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return service.updateData(request.params.id, request.body.data, user);
  });

  // PATCH /api/v1/collecte/submissions/:id/resolve-conflict — Resolve a sync conflict
  app.patch<{ Params: IdParam; Body: ResolveConflictBody }>('/api/v1/collecte/submissions/:id/resolve-conflict', {
    schema: { params: IdParamSchema, body: ResolveConflictSchema },
    preHandler: [auth, tenant],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return service.resolveConflict(request.params.id, request.body, user);
  });
}

import type { FastifyInstance } from 'fastify';
import { authHook, tenantHook } from '@aris/auth-middleware';
import type { AuthenticatedUser, AuthHookOptions } from '@aris/auth-middleware';
import { SubmissionService } from '../services/submission.service';
import {
  CreateSubmissionSchema,
  ListSubmissionsQuerySchema,
  IdParamSchema,
} from '../schemas/submission.schema';
import type {
  CreateSubmissionBody,
  ListSubmissionsQuery,
  IdParam,
} from '../schemas/submission.schema';

export default async function submissionRoutes(app: FastifyInstance): Promise<void> {
  const service = new SubmissionService(app.prisma, app.kafka.producer, app.kafka);

  const authOpts: AuthHookOptions = {
    publicKey: process.env['JWT_PUBLIC_KEY'] ?? '',
  };
  const auth = authHook(authOpts);
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

  // GET /api/v1/collecte/submissions/:id
  app.get<{ Params: IdParam }>('/api/v1/collecte/submissions/:id', {
    schema: { params: IdParamSchema },
    preHandler: [auth, tenant],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return service.findOne(request.params.id, user);
  });
}

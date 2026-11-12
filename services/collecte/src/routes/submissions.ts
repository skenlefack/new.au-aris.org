import type { FastifyInstance } from 'fastify';
import { rolesHook, tenantHook } from '@aris/auth-middleware';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { UserRole } from '@aris/shared-types';
import { SubmissionService } from '../services/submission.service';
import { ConsistencyService, REVIEWER_ROLES, type CorrectionItem } from '../services/consistency/consistency.service';
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
  const consistency = new ConsistencyService(app.prisma);
  service.setAuditor((action, id, user, reason, prev, next, cls) => consistency.audit(action, id, user, reason, prev, next, cls));

  const auth = app.authHookFn;
  const tenant = tenantHook();

  // Roles allowed to submit data (DECISION_MAKER and ANALYST are read-only)
  const SUBMIT_ROLES = [
    UserRole.SUPER_ADMIN,
    UserRole.CONTINENTAL_ADMIN,
    UserRole.REC_ADMIN,
    UserRole.NATIONAL_ADMIN,
    UserRole.DATA_STEWARD,
    UserRole.WAHIS_FOCAL_POINT,
    UserRole.FIELD_AGENT,
  ];

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
    preHandler: [auth, tenant, rolesHook(...SUBMIT_ROLES)],
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
      domain: request.query.domain,
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

  // ── Consistency review ──
  const idParams = { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } } as const;

  // POST /api/v1/collecte/submissions/consistency/summary — issue counts for a page of submissions
  app.post<{ Body: { ids: string[] } }>('/api/v1/collecte/submissions/consistency/summary', {
    schema: { body: { type: 'object', required: ['ids'], properties: { ids: { type: 'array', maxItems: 200, items: { type: 'string', format: 'uuid' } } } } },
    preHandler: [auth, tenant],
  }, async (request) => consistency.summaries(request.body.ids, request.user as AuthenticatedUser));

  // GET /api/v1/collecte/submissions/:id/consistency — suggested inconsistencies
  app.get<{ Params: IdParam }>('/api/v1/collecte/submissions/:id/consistency', {
    schema: { params: idParams },
    preHandler: [auth, tenant],
  }, async (request) => consistency.check(request.params.id, request.user as AuthenticatedUser));

  // GET /api/v1/collecte/submissions/:id/review-history — correction requests, corrections, resubmissions
  app.get<{ Params: IdParam }>('/api/v1/collecte/submissions/:id/review-history', {
    schema: { params: idParams },
    preHandler: [auth, tenant],
  }, async (request) => consistency.history(request.params.id, request.user as AuthenticatedUser));

  // PATCH /api/v1/collecte/submissions/:id/corrections — validator fixes fields directly (audited)
  app.patch<{ Params: IdParam; Body: { changes: Record<string, unknown>; reason: string } }>('/api/v1/collecte/submissions/:id/corrections', {
    schema: {
      params: idParams,
      body: { type: 'object', required: ['changes', 'reason'], properties: { changes: { type: 'object' }, reason: { type: 'string', minLength: 1, maxLength: 2000 } } },
    },
    preHandler: [auth, tenant, rolesHook(...(REVIEWER_ROLES as UserRole[]))],
  }, async (request) => consistency.correct(request.params.id, request.body.changes, request.body.reason, request.user as AuthenticatedUser));

  // POST /api/v1/collecte/submissions/:id/request-correction — send back to the collector with points to fix
  app.post<{ Params: IdParam; Body: { message?: string; items?: CorrectionItem[] } }>('/api/v1/collecte/submissions/:id/request-correction', {
    schema: {
      params: idParams,
      body: {
        type: 'object',
        properties: {
          message: { type: 'string', maxLength: 4000 },
          items: { type: 'array', maxItems: 50, items: { type: 'object', required: ['message'], properties: { field: { type: 'string' }, code: { type: 'string' }, message: { type: 'string', maxLength: 1000 } } } },
        },
      },
    },
    preHandler: [auth, tenant, rolesHook(...(REVIEWER_ROLES as UserRole[]))],
  }, async (request) => consistency.requestCorrection(request.params.id, request.body.message ?? '', request.body.items ?? [], request.user as AuthenticatedUser));

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

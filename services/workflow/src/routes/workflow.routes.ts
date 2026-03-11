import type { FastifyInstance } from 'fastify';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  CreateInstanceSchema,
  ApproveSchema,
  RejectSchema,
  ReturnSchema,
  UuidParamSchema,
  ListQuerySchema,
  type CreateInstanceInput,
  type ApproveInput,
  type RejectInput,
  type ReturnInput,
  type UuidParamInput,
  type ListQueryInput,
} from '../schemas/workflow.schemas.js';

export async function registerWorkflowRoutes(app: FastifyInstance): Promise<void> {
  const auth = app.authHookFn;

  // POST /api/v1/workflow/instances
  app.post<{ Body: CreateInstanceInput }>('/api/v1/workflow/instances', {
    schema: { body: CreateInstanceSchema },
    preHandler: [auth],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.workflowService.create(request.body, user);
    return reply.code(201).send(result);
  });

  // GET /api/v1/workflow/instances
  app.get<{ Querystring: ListQueryInput }>('/api/v1/workflow/instances', {
    schema: { querystring: ListQuerySchema },
    preHandler: [auth],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.workflowService.findAll(user, request.query);
  });

  // GET /api/v1/workflow/dashboard
  app.get('/api/v1/workflow/dashboard', {
    preHandler: [auth],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.workflowService.getDashboard(user);
  });

  // GET /api/v1/workflow/instances/:id
  app.get<{ Params: UuidParamInput }>('/api/v1/workflow/instances/:id', {
    schema: { params: UuidParamSchema },
    preHandler: [auth],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.workflowService.findOne(request.params.id, user);
  });

  // POST /api/v1/workflow/instances/:id/approve
  app.post<{ Params: UuidParamInput; Body: ApproveInput }>('/api/v1/workflow/instances/:id/approve', {
    schema: { params: UuidParamSchema, body: ApproveSchema },
    preHandler: [auth],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.workflowService.approve(request.params.id, request.body.comment, user);
  });

  // POST /api/v1/workflow/instances/:id/reject
  app.post<{ Params: UuidParamInput; Body: RejectInput }>('/api/v1/workflow/instances/:id/reject', {
    schema: { params: UuidParamSchema, body: RejectSchema },
    preHandler: [auth],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.workflowService.reject(request.params.id, request.body.reason, user);
  });

  // POST /api/v1/workflow/instances/:id/return
  app.post<{ Params: UuidParamInput; Body: ReturnInput }>('/api/v1/workflow/instances/:id/return', {
    schema: { params: UuidParamSchema, body: ReturnSchema },
    preHandler: [auth],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.workflowService.returnForCorrection(request.params.id, request.body.reason, user);
  });
}

import type { FastifyInstance } from 'fastify';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  CreateInstanceSchema,
  ApproveSchema,
  RejectSchema,
  ReturnSchema,
  CommentSchema,
  UuidParamSchema,
  ListQuerySchema,
  BulkActionSchema,
  type CreateInstanceInput,
  type ApproveInput,
  type RejectInput,
  type ReturnInput,
  type CommentInput,
  type UuidParamInput,
  type ListQueryInput,
  type BulkActionBody,
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

  // POST /api/v1/workflow/instances/bulk-action
  app.post<{ Body: BulkActionBody }>('/api/v1/workflow/instances/bulk-action', {
    schema: { body: BulkActionSchema },
    preHandler: [auth],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.workflowService.bulkAction(request.body, user);
    return { data: result };
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
  app.post<{ Params: UuidParamInput; Body: ApproveInput & { targetStepIds?: string[] } }>('/api/v1/workflow/instances/:id/approve', {
    schema: { params: UuidParamSchema },
    preHandler: [auth],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    const body = request.body as any;
    return app.workflowService.approve(request.params.id, body?.comment, user, body?.targetStepIds);
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

  // POST /api/v1/workflow/instances/:id/comment
  app.post<{ Params: UuidParamInput; Body: CommentInput }>('/api/v1/workflow/instances/:id/comment', {
    schema: { params: UuidParamSchema, body: CommentSchema },
    preHandler: [auth],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.workflowService.addComment(request.params.id, request.body.text, user);
  });

  // ── DAG Routes ──

  // GET /api/v1/workflow/instances/:id/available-routes — outgoing edges for choice UI
  app.get<{ Params: UuidParamInput }>('/api/v1/workflow/instances/:id/available-routes', {
    schema: { params: UuidParamSchema },
    preHandler: [auth],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.workflowService.getAvailableRoutes(request.params.id, user);
  });

  // GET /api/v1/workflow/instances/:id/branches — active branch tokens
  app.get<{ Params: UuidParamInput }>('/api/v1/workflow/instances/:id/branches', {
    schema: { params: UuidParamSchema },
    preHandler: [auth],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.workflowService.getInstanceBranches(request.params.id, user);
  });

  // POST /api/v1/workflow/instances/:id/branches/:tokenId/approve — approve a specific branch
  app.post<{ Params: { id: string; tokenId: string }; Body: any }>('/api/v1/workflow/instances/:id/branches/:tokenId/approve', {
    preHandler: [auth],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    const body = request.body as any;
    return app.workflowService.approveBranch(request.params.id, request.params.tokenId, body?.comment, user);
  });
}

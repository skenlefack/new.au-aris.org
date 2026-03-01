import type { FastifyInstance } from 'fastify';
import { UserRole } from '@aris/shared-types';
import { authHook, rolesHook, tenantHook } from '@aris/auth-middleware';
import type { AuthenticatedUser, AuthHookOptions } from '@aris/auth-middleware';
import {
  WorkflowDefinitionService,
  ValidationChainService,
  WorkflowInstanceService,
  CollectionCampaignService,
} from '../services/workflow-engine.service';
import {
  IdParamSchema, type IdParam,
  SubmissionIdParamSchema, type SubmissionIdParam,
  CountryCodeParamSchema, type CountryCodeParam,
  StepIdParamSchema, type StepIdParam,
  UserIdParamSchema, type UserIdParam,
  AssignIdParamSchema, type AssignIdParam,
  CreateWorkflowSchema, type CreateWorkflowBody,
  UpdateWorkflowSchema, type UpdateWorkflowBody,
  ListWorkflowsQuerySchema, type ListWorkflowsQuery,
  CreateStepSchema, type CreateStepBody,
  UpdateStepSchema, type UpdateStepBody,
  CreateValidationChainSchema, type CreateValidationChainBody,
  UpdateValidationChainSchema, type UpdateValidationChainBody,
  ListValidationChainsQuerySchema, type ListValidationChainsQuery,
  ListInstancesQuerySchema, type ListInstancesQuery,
  ValidateInstanceSchema, type ValidateInstanceBody,
  RejectInstanceSchema, type RejectInstanceBody,
  ReturnInstanceSchema, type ReturnInstanceBody,
  ReassignInstanceSchema, type ReassignInstanceBody,
  CommentInstanceSchema, type CommentInstanceBody,
  ChooseValidatorSchema, type ChooseValidatorBody,
  CreateCollectionCampaignSchema, type CreateCollectionCampaignBody,
  UpdateCollectionCampaignSchema, type UpdateCollectionCampaignBody,
  ListCollectionCampaignsQuerySchema, type ListCollectionCampaignsQuery,
  CreateAssignmentSchema, type CreateAssignmentBody,
} from '../schemas/workflow.schema';

const ADMIN_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.CONTINENTAL_ADMIN,
  UserRole.REC_ADMIN,
  UserRole.NATIONAL_ADMIN,
];

const WRITE_ROLES = [
  ...ADMIN_ROLES,
  UserRole.DATA_STEWARD,
];

export default async function workflowRoutes(app: FastifyInstance): Promise<void> {
  const wfDefService = new WorkflowDefinitionService(app.prisma, app.kafka.producer);
  const chainService = new ValidationChainService(app.prisma);
  const instanceService = new WorkflowInstanceService(app.prisma, app.kafka.producer);
  const campaignService = new CollectionCampaignService(app.prisma, app.kafka.producer);

  const authOpts: AuthHookOptions = {
    publicKey: process.env['JWT_PUBLIC_KEY'] ?? '',
  };
  const auth = authHook(authOpts);
  const tenant = tenantHook();

  // ═══════════════════════════════════════════════════════
  // WORKFLOW DEFINITIONS
  // ═══════════════════════════════════════════════════════

  // GET /api/v1/workflow/definitions
  app.get<{ Querystring: ListWorkflowsQuery }>('/api/v1/workflow/definitions', {
    schema: { querystring: ListWorkflowsQuerySchema },
    preHandler: [auth, tenant],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return wfDefService.findAll(user, request.query);
  });

  // GET /api/v1/workflow/definitions/:id
  app.get<{ Params: IdParam }>('/api/v1/workflow/definitions/:id', {
    schema: { params: IdParamSchema },
    preHandler: [auth, tenant],
  }, async (request) => {
    return wfDefService.findOne(request.params.id);
  });

  // GET /api/v1/workflow/definitions/country/:code
  app.get<{ Params: CountryCodeParam }>('/api/v1/workflow/definitions/country/:code', {
    schema: { params: CountryCodeParamSchema },
    preHandler: [auth, tenant],
  }, async (request) => {
    return wfDefService.findByCountryCode(request.params.code);
  });

  // POST /api/v1/workflow/definitions
  app.post<{ Body: CreateWorkflowBody }>('/api/v1/workflow/definitions', {
    schema: { body: CreateWorkflowSchema },
    preHandler: [auth, tenant, rolesHook(...ADMIN_ROLES)],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await wfDefService.create(request.body as Record<string, unknown>, user);
    return reply.code(201).send(result);
  });

  // PUT /api/v1/workflow/definitions/:id
  app.put<{ Params: IdParam; Body: UpdateWorkflowBody }>('/api/v1/workflow/definitions/:id', {
    schema: { params: IdParamSchema, body: UpdateWorkflowSchema },
    preHandler: [auth, tenant, rolesHook(...ADMIN_ROLES)],
  }, async (request) => {
    return wfDefService.update(request.params.id, request.body as Record<string, unknown>);
  });

  // POST /api/v1/workflow/definitions/:id/steps
  app.post<{ Params: IdParam; Body: CreateStepBody }>('/api/v1/workflow/definitions/:id/steps', {
    schema: { params: IdParamSchema, body: CreateStepSchema },
    preHandler: [auth, tenant, rolesHook(...ADMIN_ROLES)],
  }, async (request, reply) => {
    const result = await wfDefService.createStep(request.params.id, request.body as Record<string, unknown>);
    return reply.code(201).send(result);
  });

  // PUT /api/v1/workflow/definitions/:id/steps/:stepId
  app.put<{ Params: StepIdParam; Body: UpdateStepBody }>('/api/v1/workflow/definitions/:id/steps/:stepId', {
    schema: { params: StepIdParamSchema, body: UpdateStepSchema },
    preHandler: [auth, tenant, rolesHook(...ADMIN_ROLES)],
  }, async (request) => {
    return wfDefService.updateStep(request.params.id, request.params.stepId, request.body as Record<string, unknown>);
  });

  // DELETE /api/v1/workflow/definitions/:id/steps/:stepId
  app.delete<{ Params: StepIdParam }>('/api/v1/workflow/definitions/:id/steps/:stepId', {
    schema: { params: StepIdParamSchema },
    preHandler: [auth, tenant, rolesHook(...ADMIN_ROLES)],
  }, async (request, reply) => {
    await wfDefService.deleteStep(request.params.id, request.params.stepId);
    return reply.code(204).send();
  });

  // ═══════════════════════════════════════════════════════
  // VALIDATION CHAINS
  // ═══════════════════════════════════════════════════════

  // GET /api/v1/workflow/validation-chains
  app.get<{ Querystring: ListValidationChainsQuery }>('/api/v1/workflow/validation-chains', {
    schema: { querystring: ListValidationChainsQuerySchema },
    preHandler: [auth, tenant],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return chainService.findAll(user, request.query);
  });

  // GET /api/v1/workflow/validation-chains/user/:userId
  app.get<{ Params: UserIdParam }>('/api/v1/workflow/validation-chains/user/:userId', {
    schema: { params: UserIdParamSchema },
    preHandler: [auth, tenant],
  }, async (request) => {
    return chainService.findByUser(request.params.userId);
  });

  // GET /api/v1/workflow/validation-chains/validator/:userId
  app.get<{ Params: UserIdParam }>('/api/v1/workflow/validation-chains/validator/:userId', {
    schema: { params: UserIdParamSchema },
    preHandler: [auth, tenant],
  }, async (request) => {
    return chainService.findByValidator(request.params.userId);
  });

  // POST /api/v1/workflow/validation-chains
  app.post<{ Body: CreateValidationChainBody }>('/api/v1/workflow/validation-chains', {
    schema: { body: CreateValidationChainSchema },
    preHandler: [auth, tenant, rolesHook(...ADMIN_ROLES)],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await chainService.create(request.body as Record<string, unknown>, user);
    return reply.code(201).send(result);
  });

  // PUT /api/v1/workflow/validation-chains/:id
  app.put<{ Params: IdParam; Body: UpdateValidationChainBody }>('/api/v1/workflow/validation-chains/:id', {
    schema: { params: IdParamSchema, body: UpdateValidationChainSchema },
    preHandler: [auth, tenant, rolesHook(...ADMIN_ROLES)],
  }, async (request) => {
    return chainService.update(request.params.id, request.body as Record<string, unknown>);
  });

  // DELETE /api/v1/workflow/validation-chains/:id
  app.delete<{ Params: IdParam }>('/api/v1/workflow/validation-chains/:id', {
    schema: { params: IdParamSchema },
    preHandler: [auth, tenant, rolesHook(...ADMIN_ROLES)],
  }, async (request, reply) => {
    await chainService.delete(request.params.id);
    return reply.code(204).send();
  });

  // ═══════════════════════════════════════════════════════
  // WORKFLOW INSTANCES (ENGINE)
  // ═══════════════════════════════════════════════════════

  // POST /api/v1/workflow/submissions/:submissionId/start
  app.post<{ Params: SubmissionIdParam }>('/api/v1/workflow/submissions/:submissionId/start', {
    schema: { params: SubmissionIdParamSchema },
    preHandler: [auth, tenant],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await instanceService.startWorkflow(request.params.submissionId, user);
    return reply.code(201).send(result);
  });

  // GET /api/v1/workflow/instances
  app.get<{ Querystring: ListInstancesQuery }>('/api/v1/workflow/instances', {
    schema: { querystring: ListInstancesQuerySchema },
    preHandler: [auth, tenant],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return instanceService.findAll(user, request.query);
  });

  // GET /api/v1/workflow/instances/:id
  app.get<{ Params: IdParam }>('/api/v1/workflow/instances/:id', {
    schema: { params: IdParamSchema },
    preHandler: [auth, tenant],
  }, async (request) => {
    return instanceService.findOne(request.params.id);
  });

  // POST /api/v1/workflow/instances/:id/validate
  app.post<{ Params: IdParam; Body: ValidateInstanceBody }>('/api/v1/workflow/instances/:id/validate', {
    schema: { params: IdParamSchema, body: ValidateInstanceSchema },
    preHandler: [auth, tenant],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return instanceService.validate(request.params.id, request.body as Record<string, unknown>, user);
  });

  // POST /api/v1/workflow/instances/:id/reject
  app.post<{ Params: IdParam; Body: RejectInstanceBody }>('/api/v1/workflow/instances/:id/reject', {
    schema: { params: IdParamSchema, body: RejectInstanceSchema },
    preHandler: [auth, tenant],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return instanceService.reject(request.params.id, request.body as Record<string, unknown>, user);
  });

  // POST /api/v1/workflow/instances/:id/return
  app.post<{ Params: IdParam; Body: ReturnInstanceBody }>('/api/v1/workflow/instances/:id/return', {
    schema: { params: IdParamSchema, body: ReturnInstanceSchema },
    preHandler: [auth, tenant],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return instanceService.returnForCorrection(request.params.id, request.body as Record<string, unknown>, user);
  });

  // POST /api/v1/workflow/instances/:id/reassign
  app.post<{ Params: IdParam; Body: ReassignInstanceBody }>('/api/v1/workflow/instances/:id/reassign', {
    schema: { params: IdParamSchema, body: ReassignInstanceSchema },
    preHandler: [auth, tenant, rolesHook(...WRITE_ROLES)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return instanceService.reassign(request.params.id, request.body as Record<string, unknown>, user);
  });

  // POST /api/v1/workflow/instances/:id/comment
  app.post<{ Params: IdParam; Body: CommentInstanceBody }>('/api/v1/workflow/instances/:id/comment', {
    schema: { params: IdParamSchema, body: CommentInstanceSchema },
    preHandler: [auth, tenant],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return instanceService.addComment(request.params.id, request.body as Record<string, unknown>, user);
  });

  // POST /api/v1/workflow/instances/:id/choose-validator
  app.post<{ Params: IdParam; Body: ChooseValidatorBody }>('/api/v1/workflow/instances/:id/choose-validator', {
    schema: { params: IdParamSchema, body: ChooseValidatorSchema },
    preHandler: [auth, tenant],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return instanceService.validate(
      request.params.id,
      { nextValidatorId: request.body.validatorId },
      user,
    );
  });

  // GET /api/v1/workflow/instances/:id/history
  app.get<{ Params: IdParam }>('/api/v1/workflow/instances/:id/history', {
    schema: { params: IdParamSchema },
    preHandler: [auth, tenant],
  }, async (request) => {
    return instanceService.getHistory(request.params.id);
  });

  // ═══════════════════════════════════════════════════════
  // DASHBOARD
  // ═══════════════════════════════════════════════════════

  // GET /api/v1/workflow/dashboard/my-tasks
  app.get<{ Querystring: ListInstancesQuery }>('/api/v1/workflow/dashboard/my-tasks', {
    schema: { querystring: ListInstancesQuerySchema },
    preHandler: [auth, tenant],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return instanceService.getMyTasks(user, request.query);
  });

  // GET /api/v1/workflow/dashboard/my-submissions
  app.get<{ Querystring: ListInstancesQuery }>('/api/v1/workflow/dashboard/my-submissions', {
    schema: { querystring: ListInstancesQuerySchema },
    preHandler: [auth, tenant],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return instanceService.getMySubmissions(user, request.query);
  });

  // GET /api/v1/workflow/dashboard/stats
  app.get('/api/v1/workflow/dashboard/stats', {
    preHandler: [auth, tenant],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return instanceService.getStats(user);
  });

  // GET /api/v1/workflow/dashboard/overdue
  app.get<{ Querystring: ListInstancesQuery }>('/api/v1/workflow/dashboard/overdue', {
    schema: { querystring: ListInstancesQuerySchema },
    preHandler: [auth, tenant],
  }, async (request) => {
    return instanceService.getOverdue(request.query);
  });

  // GET /api/v1/workflow/dashboard/timeline/:id
  app.get<{ Params: IdParam }>('/api/v1/workflow/dashboard/timeline/:id', {
    schema: { params: IdParamSchema },
    preHandler: [auth, tenant],
  }, async (request) => {
    return instanceService.getTimeline(request.params.id);
  });

  // ═══════════════════════════════════════════════════════
  // COLLECTION CAMPAIGNS
  // ═══════════════════════════════════════════════════════

  // GET /api/v1/workflow/campaigns
  app.get<{ Querystring: ListCollectionCampaignsQuery }>('/api/v1/workflow/campaigns', {
    schema: { querystring: ListCollectionCampaignsQuerySchema },
    preHandler: [auth, tenant],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return campaignService.findAll(user, request.query);
  });

  // GET /api/v1/workflow/campaigns/:id
  app.get<{ Params: IdParam }>('/api/v1/workflow/campaigns/:id', {
    schema: { params: IdParamSchema },
    preHandler: [auth, tenant],
  }, async (request) => {
    return campaignService.findOne(request.params.id);
  });

  // POST /api/v1/workflow/campaigns
  app.post<{ Body: CreateCollectionCampaignBody }>('/api/v1/workflow/campaigns', {
    schema: { body: CreateCollectionCampaignSchema },
    preHandler: [auth, tenant, rolesHook(...ADMIN_ROLES)],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await campaignService.create(request.body as Record<string, unknown>, user);
    return reply.code(201).send(result);
  });

  // PUT /api/v1/workflow/campaigns/:id
  app.put<{ Params: IdParam; Body: UpdateCollectionCampaignBody }>('/api/v1/workflow/campaigns/:id', {
    schema: { params: IdParamSchema, body: UpdateCollectionCampaignSchema },
    preHandler: [auth, tenant, rolesHook(...ADMIN_ROLES)],
  }, async (request) => {
    return campaignService.update(request.params.id, request.body as Record<string, unknown>);
  });

  // POST /api/v1/workflow/campaigns/:id/activate
  app.post<{ Params: IdParam }>('/api/v1/workflow/campaigns/:id/activate', {
    schema: { params: IdParamSchema },
    preHandler: [auth, tenant, rolesHook(...ADMIN_ROLES)],
  }, async (request) => {
    return campaignService.updateStatus(request.params.id, 'ACTIVE');
  });

  // POST /api/v1/workflow/campaigns/:id/pause
  app.post<{ Params: IdParam }>('/api/v1/workflow/campaigns/:id/pause', {
    schema: { params: IdParamSchema },
    preHandler: [auth, tenant, rolesHook(...ADMIN_ROLES)],
  }, async (request) => {
    return campaignService.updateStatus(request.params.id, 'PAUSED');
  });

  // POST /api/v1/workflow/campaigns/:id/complete
  app.post<{ Params: IdParam }>('/api/v1/workflow/campaigns/:id/complete', {
    schema: { params: IdParamSchema },
    preHandler: [auth, tenant, rolesHook(...ADMIN_ROLES)],
  }, async (request) => {
    return campaignService.updateStatus(request.params.id, 'COMPLETED');
  });

  // POST /api/v1/workflow/campaigns/:id/assignments
  app.post<{ Params: IdParam; Body: CreateAssignmentBody }>('/api/v1/workflow/campaigns/:id/assignments', {
    schema: { params: IdParamSchema, body: CreateAssignmentSchema },
    preHandler: [auth, tenant, rolesHook(...ADMIN_ROLES)],
  }, async (request, reply) => {
    const result = await campaignService.addAssignment(request.params.id, request.body as Record<string, unknown>);
    return reply.code(201).send(result);
  });

  // GET /api/v1/workflow/campaigns/:id/progress
  app.get<{ Params: IdParam }>('/api/v1/workflow/campaigns/:id/progress', {
    schema: { params: IdParamSchema },
    preHandler: [auth, tenant],
  }, async (request) => {
    return campaignService.getProgress(request.params.id);
  });

  // DELETE /api/v1/workflow/campaigns/:id/assignments/:assignId
  app.delete<{ Params: AssignIdParam }>('/api/v1/workflow/campaigns/:id/assignments/:assignId', {
    schema: { params: AssignIdParamSchema },
    preHandler: [auth, tenant, rolesHook(...ADMIN_ROLES)],
  }, async (request, reply) => {
    await campaignService.removeAssignment(request.params.id, request.params.assignId);
    return reply.code(204).send();
  });
}

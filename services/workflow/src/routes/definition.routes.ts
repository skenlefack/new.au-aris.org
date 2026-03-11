import type { FastifyInstance } from 'fastify';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  CreateDefinitionSchema,
  UpdateDefinitionSchema,
  CreateStepSchema,
  UpdateStepSchema,
  DefinitionListQuerySchema,
  DefinitionIdParamSchema,
  CountryCodeParamSchema,
  StepParamsSchema,
  type CreateDefinitionInput,
  type UpdateDefinitionInput,
  type CreateStepInput,
  type UpdateStepInput,
  type DefinitionListQueryInput,
  type DefinitionIdParamInput,
  type CountryCodeParamInput,
  type StepParamsInput,
} from '../schemas/definition.schemas.js';

export async function registerDefinitionRoutes(app: FastifyInstance): Promise<void> {
  const auth = app.authHookFn;

  // GET /api/v1/workflow/definitions
  app.get<{ Querystring: DefinitionListQueryInput }>('/api/v1/workflow/definitions', {
    schema: { querystring: DefinitionListQuerySchema },
    preHandler: [auth],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.definitionService.findAll(user, request.query);
  });

  // POST /api/v1/workflow/definitions
  app.post<{ Body: CreateDefinitionInput }>('/api/v1/workflow/definitions', {
    schema: { body: CreateDefinitionSchema },
    preHandler: [auth],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.definitionService.create(request.body, user);
    return reply.code(201).send(result);
  });

  // GET /api/v1/workflow/definitions/country/:code
  app.get<{ Params: CountryCodeParamInput }>('/api/v1/workflow/definitions/country/:code', {
    schema: { params: CountryCodeParamSchema },
    preHandler: [auth],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.definitionService.findByCountry(request.params.code, user);
  });

  // GET /api/v1/workflow/definitions/:id
  app.get<{ Params: DefinitionIdParamInput }>('/api/v1/workflow/definitions/:id', {
    schema: { params: DefinitionIdParamSchema },
    preHandler: [auth],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.definitionService.findOne(request.params.id, user);
  });

  // PUT /api/v1/workflow/definitions/:id
  app.put<{ Params: DefinitionIdParamInput; Body: UpdateDefinitionInput }>('/api/v1/workflow/definitions/:id', {
    schema: { params: DefinitionIdParamSchema, body: UpdateDefinitionSchema },
    preHandler: [auth],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.definitionService.update(request.params.id, request.body, user);
  });

  // POST /api/v1/workflow/definitions/:id/steps
  app.post<{ Params: DefinitionIdParamInput; Body: CreateStepInput }>('/api/v1/workflow/definitions/:id/steps', {
    schema: { params: DefinitionIdParamSchema, body: CreateStepSchema },
    preHandler: [auth],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.definitionService.createStep(request.params.id, request.body, user);
    return reply.code(201).send(result);
  });

  // PUT /api/v1/workflow/definitions/:id/steps/:stepId
  app.put<{ Params: StepParamsInput; Body: UpdateStepInput }>('/api/v1/workflow/definitions/:id/steps/:stepId', {
    schema: { params: StepParamsSchema, body: UpdateStepSchema },
    preHandler: [auth],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.definitionService.updateStep(request.params.id, request.params.stepId, request.body, user);
  });

  // DELETE /api/v1/workflow/definitions/:id/steps/:stepId
  app.delete<{ Params: StepParamsInput }>('/api/v1/workflow/definitions/:id/steps/:stepId', {
    schema: { params: StepParamsSchema },
    preHandler: [auth],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    await app.definitionService.deleteStep(request.params.id, request.params.stepId, user);
    return reply.code(204).send();
  });
}

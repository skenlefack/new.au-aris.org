import type { FastifyInstance } from 'fastify';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  CreateChainSchema,
  UpdateChainSchema,
  ChainListQuerySchema,
  ChainIdParamSchema,
  ChainUserParamSchema,
  ChainValidatorParamSchema,
  type CreateChainInput,
  type UpdateChainInput,
  type ChainListQueryInput,
  type ChainIdParamInput,
  type ChainUserParamInput,
  type ChainValidatorParamInput,
} from '../schemas/validation-chain.schemas.js';

export async function registerValidationChainRoutes(app: FastifyInstance): Promise<void> {
  const auth = app.authHookFn;

  // GET /api/v1/workflow/validation-chains
  app.get<{ Querystring: ChainListQueryInput }>('/api/v1/workflow/validation-chains', {
    schema: { querystring: ChainListQuerySchema },
    preHandler: [auth],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.validationChainService.findAll(user, request.query);
  });

  // POST /api/v1/workflow/validation-chains
  app.post<{ Body: CreateChainInput }>('/api/v1/workflow/validation-chains', {
    schema: { body: CreateChainSchema },
    preHandler: [auth],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.validationChainService.create(request.body, user);
    return reply.code(201).send(result);
  });

  // GET /api/v1/workflow/validation-chains/user/:userId
  app.get<{ Params: ChainUserParamInput }>('/api/v1/workflow/validation-chains/user/:userId', {
    schema: { params: ChainUserParamSchema },
    preHandler: [auth],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.validationChainService.findByUser(request.params.userId, user);
  });

  // GET /api/v1/workflow/validation-chains/validator/:validatorId
  app.get<{ Params: ChainValidatorParamInput }>('/api/v1/workflow/validation-chains/validator/:validatorId', {
    schema: { params: ChainValidatorParamSchema },
    preHandler: [auth],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.validationChainService.findByValidator(request.params.validatorId, user);
  });

  // PUT /api/v1/workflow/validation-chains/:id
  app.put<{ Params: ChainIdParamInput; Body: UpdateChainInput }>('/api/v1/workflow/validation-chains/:id', {
    schema: { params: ChainIdParamSchema, body: UpdateChainSchema },
    preHandler: [auth],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.validationChainService.update(request.params.id, request.body, user);
  });

  // DELETE /api/v1/workflow/validation-chains/:id
  app.delete<{ Params: ChainIdParamInput }>('/api/v1/workflow/validation-chains/:id', {
    schema: { params: ChainIdParamSchema },
    preHandler: [auth],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    await app.validationChainService.delete(request.params.id, user);
    return reply.code(204).send();
  });
}

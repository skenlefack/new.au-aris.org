import type { FastifyInstance } from 'fastify';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { Type, type Static } from '@sinclair/typebox';

const I18nText = Type.Object({
  en: Type.Optional(Type.String()),
  fr: Type.Optional(Type.String()),
  pt: Type.Optional(Type.String()),
  ar: Type.Optional(Type.String()),
});

const TemplateListQuerySchema = Type.Object({
  page: Type.Optional(Type.Number({ minimum: 1 })),
  limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
  category: Type.Optional(Type.String()),
  search: Type.Optional(Type.String()),
});

const TemplateIdParamSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
});

const DefinitionIdParamSchema = Type.Object({
  definitionId: Type.String({ format: 'uuid' }),
});

const ApplyParamsSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  definitionId: Type.String({ format: 'uuid' }),
});

const CreateTemplateSchema = Type.Object({
  name: I18nText,
  description: Type.Optional(I18nText),
  category: Type.Optional(Type.String({ maxLength: 50 })),
  tags: Type.Optional(Type.Array(Type.String())),
  graphSnapshot: Type.Any(),
});

const CreateFromDefinitionSchema = Type.Object({
  name: I18nText,
  description: Type.Optional(I18nText),
  category: Type.Optional(Type.String({ maxLength: 50 })),
  tags: Type.Optional(Type.Array(Type.String())),
});

type TemplateListQueryInput = Static<typeof TemplateListQuerySchema>;
type TemplateIdParamInput = Static<typeof TemplateIdParamSchema>;
type DefinitionIdParamInput = Static<typeof DefinitionIdParamSchema>;
type ApplyParamsInput = Static<typeof ApplyParamsSchema>;
type CreateTemplateInput = Static<typeof CreateTemplateSchema>;
type CreateFromDefinitionInput = Static<typeof CreateFromDefinitionSchema>;

export async function registerTemplateRoutes(app: FastifyInstance): Promise<void> {
  const auth = app.authHookFn;

  // GET /api/v1/workflow/templates
  app.get<{ Querystring: TemplateListQueryInput }>('/api/v1/workflow/templates', {
    schema: { querystring: TemplateListQuerySchema },
    preHandler: [auth],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.templateService.listTemplates(user, request.query);
  });

  // GET /api/v1/workflow/templates/:id
  app.get<{ Params: TemplateIdParamInput }>('/api/v1/workflow/templates/:id', {
    schema: { params: TemplateIdParamSchema },
    preHandler: [auth],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.templateService.getTemplate(request.params.id, user);
  });

  // POST /api/v1/workflow/templates
  app.post<{ Body: CreateTemplateInput }>('/api/v1/workflow/templates', {
    schema: { body: CreateTemplateSchema },
    preHandler: [auth],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.templateService.createTemplate(request.body, user);
    return reply.code(201).send(result);
  });

  // POST /api/v1/workflow/templates/from-definition/:definitionId
  app.post<{ Params: DefinitionIdParamInput; Body: CreateFromDefinitionInput }>('/api/v1/workflow/templates/from-definition/:definitionId', {
    schema: { params: DefinitionIdParamSchema, body: CreateFromDefinitionSchema },
    preHandler: [auth],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.templateService.createFromDefinition(
      request.params.definitionId,
      request.body,
      user,
    );
    return reply.code(201).send(result);
  });

  // POST /api/v1/workflow/templates/:id/apply/:definitionId
  app.post<{ Params: ApplyParamsInput }>('/api/v1/workflow/templates/:id/apply/:definitionId', {
    schema: { params: ApplyParamsSchema },
    preHandler: [auth],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.templateService.applyTemplate(
      request.params.id,
      request.params.definitionId,
      user,
    );
  });

  // DELETE /api/v1/workflow/templates/:id
  app.delete<{ Params: TemplateIdParamInput }>('/api/v1/workflow/templates/:id', {
    schema: { params: TemplateIdParamSchema },
    preHandler: [auth],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    await app.templateService.deleteTemplate(request.params.id, user);
    return reply.code(204).send();
  });
}

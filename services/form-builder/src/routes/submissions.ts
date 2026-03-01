import type { FastifyInstance } from 'fastify';
import { Type, Static } from '@sinclair/typebox';
import { UserRole } from '@aris/shared-types';
import { authHook, rolesHook, tenantHook } from '@aris/auth-middleware';
import type { AuthenticatedUser, AuthHookOptions } from '@aris/auth-middleware';
import { SubmissionService } from '../services/submission.service';

const IdParamSchema = Type.Object({ id: Type.String({ format: 'uuid' }) });
type IdParam = Static<typeof IdParamSchema>;

const TemplateIdParamSchema = Type.Object({ templateId: Type.String({ format: 'uuid' }) });
type TemplateIdParam = Static<typeof TemplateIdParamSchema>;

const SubmissionIdParamSchema = Type.Object({
  templateId: Type.String({ format: 'uuid' }),
  submissionId: Type.String({ format: 'uuid' }),
});
type SubmissionIdParam = Static<typeof SubmissionIdParamSchema>;

const CreateSubmissionSchema = Type.Object({
  data: Type.Record(Type.String(), Type.Unknown()),
  status: Type.Optional(Type.Union([Type.Literal('DRAFT'), Type.Literal('SUBMITTED')])),
  geoLocation: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  deviceInfo: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});
type CreateSubmissionBody = Static<typeof CreateSubmissionSchema>;

const UpdateSubmissionSchema = Type.Object({
  data: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  status: Type.Optional(Type.Union([Type.Literal('DRAFT'), Type.Literal('SUBMITTED')])),
});
type UpdateSubmissionBody = Static<typeof UpdateSubmissionSchema>;

const ListSubmissionsQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  status: Type.Optional(Type.String()),
});
type ListSubmissionsQuery = Static<typeof ListSubmissionsQuerySchema>;

const FieldValuesQuerySchema = Type.Object({
  templateId: Type.String({ format: 'uuid' }),
  fieldCode: Type.String(),
});
type FieldValuesParam = Static<typeof FieldValuesQuerySchema>;

export default async function submissionRoutes(app: FastifyInstance): Promise<void> {
  const service = new SubmissionService(app.prisma, app.kafka.producer);

  const authOpts: AuthHookOptions = {
    publicKey: process.env['JWT_PUBLIC_KEY'] ?? '',
  };
  const auth = authHook(authOpts);
  const tenant = tenantHook();

  // POST /api/v1/form-builder/templates/:templateId/submissions
  app.post<{ Params: TemplateIdParam; Body: CreateSubmissionBody }>(
    '/api/v1/form-builder/templates/:templateId/submissions',
    {
      schema: { params: TemplateIdParamSchema, body: CreateSubmissionSchema },
      preHandler: [auth, tenant],
    },
    async (request, reply) => {
      const user = request.user as AuthenticatedUser;
      const result = await service.create(request.params.templateId, request.body, user);
      return reply.code(201).send(result);
    },
  );

  // GET /api/v1/form-builder/templates/:templateId/submissions
  app.get<{ Params: TemplateIdParam; Querystring: ListSubmissionsQuery }>(
    '/api/v1/form-builder/templates/:templateId/submissions',
    {
      schema: { params: TemplateIdParamSchema, querystring: ListSubmissionsQuerySchema },
      preHandler: [auth, tenant],
    },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      return service.findAll(request.params.templateId, user, request.query);
    },
  );

  // GET /api/v1/form-builder/submissions/:id
  app.get<{ Params: IdParam }>(
    '/api/v1/form-builder/submissions/:id',
    {
      schema: { params: IdParamSchema },
      preHandler: [auth, tenant],
    },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      return service.findOne(request.params.id, user);
    },
  );

  // PATCH /api/v1/form-builder/submissions/:id
  app.patch<{ Params: IdParam; Body: UpdateSubmissionBody }>(
    '/api/v1/form-builder/submissions/:id',
    {
      schema: { params: IdParamSchema, body: UpdateSubmissionSchema },
      preHandler: [auth, tenant],
    },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      return service.update(request.params.id, request.body, user);
    },
  );

  // GET /api/v1/form-builder/templates/:templateId/field-values/:fieldCode
  // For form-data-select: query unique field values from submissions
  app.get<{ Params: FieldValuesParam; Querystring: { search?: string; limit?: string } }>(
    '/api/v1/form-builder/templates/:templateId/field-values/:fieldCode',
    {
      schema: { params: FieldValuesQuerySchema },
      preHandler: [auth, tenant],
    },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      return service.queryFieldValues(
        request.params.templateId,
        request.params.fieldCode,
        user,
        {
          search: request.query.search,
          limit: request.query.limit ? parseInt(request.query.limit) : undefined,
        },
      );
    },
  );
}

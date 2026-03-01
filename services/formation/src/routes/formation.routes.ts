import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { rolesHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  createSessionSchema,
  updateSessionSchema,
  enrollParticipantSchema,
  issueCertificationSchema,
  listQuerySchema,
  idParamSchema,
} from '../schemas/formation.schema';
import type {
  CreateSessionDto,
  UpdateSessionDto,
  ListQuery,
  EnrollParticipantDto,
  IssueCertificationDto,
} from '../services/formation.service';

export async function registerFormationRoutes(app: FastifyInstance): Promise<void> {
  const PREFIX = '/api/v1/formation';

  // POST /api/v1/formation/sessions — Create training session
  app.post(`${PREFIX}/sessions`, {
    preHandler: [
      app.authHookFn,
      rolesHook(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN, UserRole.REC_ADMIN, UserRole.NATIONAL_ADMIN, UserRole.DATA_STEWARD),
    ],
    schema: createSessionSchema,
  }, async (request: FastifyRequest<{ Body: CreateSessionDto }>, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.formationService.createSession(request.body, user.tenantId, user.userId);
    return reply.code(201).send(result);
  });

  // GET /api/v1/formation/sessions — List with pagination
  app.get(`${PREFIX}/sessions`, {
    preHandler: [app.authHookFn],
    schema: listQuerySchema,
  }, async (request: FastifyRequest<{ Querystring: ListQuery }>, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.formationService.listSessions(user.tenantId, request.query);
    return reply.code(200).send(result);
  });

  // GET /api/v1/formation/sessions/:id — Get by ID
  app.get(`${PREFIX}/sessions/:id`, {
    preHandler: [app.authHookFn],
    schema: idParamSchema,
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.formationService.getSession(request.params.id, user.tenantId);
    return reply.code(200).send(result);
  });

  // PUT /api/v1/formation/sessions/:id — Update
  app.put(`${PREFIX}/sessions/:id`, {
    preHandler: [
      app.authHookFn,
      rolesHook(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN, UserRole.REC_ADMIN, UserRole.NATIONAL_ADMIN, UserRole.DATA_STEWARD),
    ],
    schema: updateSessionSchema,
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: UpdateSessionDto }>, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.formationService.updateSession(request.params.id, request.body, user.tenantId, user.userId);
    return reply.code(200).send(result);
  });

  // DELETE /api/v1/formation/sessions/:id — Soft delete
  app.delete(`${PREFIX}/sessions/:id`, {
    preHandler: [
      app.authHookFn,
      rolesHook(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN, UserRole.REC_ADMIN, UserRole.NATIONAL_ADMIN),
    ],
    schema: idParamSchema,
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.formationService.deleteSession(request.params.id, user.tenantId, user.userId);
    return reply.code(200).send(result);
  });

  // POST /api/v1/formation/sessions/:id/participants — Enroll
  app.post(`${PREFIX}/sessions/:id/participants`, {
    preHandler: [
      app.authHookFn,
      rolesHook(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN, UserRole.REC_ADMIN, UserRole.NATIONAL_ADMIN, UserRole.DATA_STEWARD),
    ],
    schema: enrollParticipantSchema,
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: EnrollParticipantDto }>, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.formationService.enrollParticipant(request.params.id, request.body, user.tenantId, user.userId);
    return reply.code(201).send(result);
  });

  // GET /api/v1/formation/sessions/:id/participants — List participants
  app.get(`${PREFIX}/sessions/:id/participants`, {
    preHandler: [app.authHookFn],
    schema: idParamSchema,
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.formationService.listParticipants(request.params.id, user.tenantId);
    return reply.code(200).send(result);
  });

  // POST /api/v1/formation/sessions/:id/certifications — Issue certification
  app.post(`${PREFIX}/sessions/:id/certifications`, {
    preHandler: [
      app.authHookFn,
      rolesHook(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN, UserRole.REC_ADMIN, UserRole.NATIONAL_ADMIN),
    ],
    schema: issueCertificationSchema,
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: IssueCertificationDto }>, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.formationService.issueCertification(request.params.id, request.body, user.tenantId, user.userId);
    return reply.code(201).send(result);
  });
}

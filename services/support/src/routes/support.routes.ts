import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { rolesHook } from '@aris/auth-middleware';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  CreateTicketSchema,
  UpdateTicketSchema,
  AddCommentSchema,
  ListTicketsSchema,
  IdParamSchema,
  EscalateSchema,
  SlaStatsSchema,
} from '../schemas/support.schema';
import type {
  CreateTicketDto,
  UpdateTicketDto,
  AddCommentDto,
  ListQuery,
  EscalateDto,
  SlaStatsQuery,
} from '../schemas/support.schema';

const ADMIN_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.CONTINENTAL_ADMIN,
  UserRole.REC_ADMIN,
  UserRole.NATIONAL_ADMIN,
];

export async function registerSupportRoutes(app: FastifyInstance): Promise<void> {
  const PREFIX = '/api/v1/support';

  // POST /api/v1/support/tickets — Create ticket (any authenticated user)
  app.post(`${PREFIX}/tickets`, {
    preHandler: [app.authHookFn],
    schema: CreateTicketSchema,
  }, async (request: FastifyRequest<{ Body: CreateTicketDto }>, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.supportService.createTicket(
      request.body, user.tenantId, user.userId, (user as any).email,
    );
    return reply.code(201).send(result);
  });

  // GET /api/v1/support/tickets — List with pagination + filters (visibility based on role)
  app.get(`${PREFIX}/tickets`, {
    preHandler: [app.authHookFn],
    schema: ListTicketsSchema,
  }, async (request: FastifyRequest<{ Querystring: ListQuery }>, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.supportService.listTickets(
      user.tenantId, (user as any).role ?? 'FIELD_AGENT', user.userId, request.query,
    );
    return reply.code(200).send(result);
  });

  // GET /api/v1/support/tickets/count — Open ticket count (admins only, for sidebar badge)
  app.get(`${PREFIX}/tickets/count`, {
    preHandler: [app.authHookFn, rolesHook(...ADMIN_ROLES)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const count = await app.supportService.getOpenTicketCount(
      user.tenantId, (user as any).role ?? 'NATIONAL_ADMIN',
    );
    return reply.code(200).send({ data: { count } });
  });

  // GET /api/v1/support/tickets/:id — Get by ID (access control based on role)
  app.get(`${PREFIX}/tickets/:id`, {
    preHandler: [app.authHookFn],
    schema: IdParamSchema,
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.supportService.getTicket(
      request.params.id, user.tenantId, (user as any).role ?? 'FIELD_AGENT', user.userId,
    );
    return reply.code(200).send(result);
  });

  // PATCH /api/v1/support/tickets/:id — Update (admin roles only)
  app.patch(`${PREFIX}/tickets/:id`, {
    preHandler: [app.authHookFn, rolesHook(...ADMIN_ROLES)],
    schema: UpdateTicketSchema,
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: UpdateTicketDto }>, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.supportService.updateTicket(
      request.params.id, request.body, user.tenantId, (user as any).role ?? 'NATIONAL_ADMIN', user.userId,
    );
    return reply.code(200).send(result);
  });

  // POST /api/v1/support/tickets/:id/escalate — Escalate to higher tenant (admin only)
  app.post(`${PREFIX}/tickets/:id/escalate`, {
    preHandler: [app.authHookFn, rolesHook(...ADMIN_ROLES)],
    schema: EscalateSchema,
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: EscalateDto }>, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.supportService.escalateTicket(request.params.id, request.body, user.tenantId, user.userId);
    return reply.code(200).send(result);
  });

  // POST /api/v1/support/tickets/:id/comments — Add comment (admin roles ONLY)
  app.post(`${PREFIX}/tickets/:id/comments`, {
    preHandler: [app.authHookFn, rolesHook(...ADMIN_ROLES)],
    schema: AddCommentSchema,
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: AddCommentDto }>, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.supportService.addComment(
      request.params.id, request.body, user.tenantId, (user as any).role ?? 'NATIONAL_ADMIN', user.userId,
    );
    return reply.code(201).send(result);
  });

  // GET /api/v1/support/tickets/:id/comments — List comments
  app.get(`${PREFIX}/tickets/:id/comments`, {
    preHandler: [app.authHookFn],
    schema: IdParamSchema,
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.supportService.listComments(
      request.params.id, user.tenantId, (user as any).role ?? 'FIELD_AGENT', user.userId,
    );
    return reply.code(200).send(result);
  });

  // POST /api/v1/support/sla/check — Trigger SLA breach check (super/continental admin)
  app.post(`${PREFIX}/sla/check`, {
    preHandler: [app.authHookFn, rolesHook(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN)],
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const breachedCount = await app.supportService.checkSlaBreaches();
    return reply.code(200).send({ data: { breachedCount } });
  });

  // GET /api/v1/support/sla/stats — SLA compliance stats (admin roles)
  app.get(`${PREFIX}/sla/stats`, {
    preHandler: [app.authHookFn, rolesHook(...ADMIN_ROLES)],
    schema: SlaStatsSchema,
  }, async (request: FastifyRequest<{ Querystring: SlaStatsQuery }>, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.supportService.getSlaStats(
      user.tenantId, (user as any).role ?? 'NATIONAL_ADMIN', request.query,
    );
    return reply.code(200).send(result);
  });
}

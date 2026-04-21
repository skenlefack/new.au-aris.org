import type { FastifyInstance } from 'fastify';
import { Type, type Static } from '@sinclair/typebox';
import { tenantHook, rolesHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

const AuditQuerySchema = Type.Object({
  page: Type.Optional(Type.Number({ minimum: 1 })),
  limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
  action: Type.Optional(Type.String()),
  entityType: Type.Optional(Type.String()),
  search: Type.Optional(Type.String()),
});

type AuditQueryInput = Static<typeof AuditQuerySchema>;

export async function registerAuditRoutes(app: FastifyInstance): Promise<void> {
  const authAndTenant = [app.authHookFn, tenantHook()];

  // GET /api/v1/credential/audit — query audit log
  app.get<{ Querystring: AuditQueryInput }>('/api/v1/credential/audit', {
    schema: { querystring: AuditQuerySchema },
    preHandler: [
      ...authAndTenant,
      rolesHook(
        UserRole.SUPER_ADMIN,
        UserRole.CONTINENTAL_ADMIN,
        UserRole.REC_ADMIN,
        UserRole.NATIONAL_ADMIN,
      ),
    ],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.auditService.query(user, request.query);
  });
}

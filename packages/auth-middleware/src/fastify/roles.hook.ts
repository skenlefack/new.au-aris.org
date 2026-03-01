import type { FastifyRequest, FastifyReply } from 'fastify';
import { UserRole, TenantLevel } from '@aris/shared-types';
import type { AuthenticatedUser } from '../interfaces/jwt-payload.interface';

/**
 * Returns a Fastify preHandler that checks if the authenticated user
 * has one of the required roles.
 */
export function rolesHook(...requiredRoles: UserRole[]) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    const user = request.user as AuthenticatedUser | undefined;
    if (!user) {
      return reply.code(403).send({
        statusCode: 403,
        message: 'User not authenticated',
      });
    }

    if (requiredRoles.length === 0) {
      return;
    }

    if (!requiredRoles.includes(user.role)) {
      return reply.code(403).send({
        statusCode: 403,
        message: `Role ${user.role} is not authorized. Required: ${requiredRoles.join(', ')}`,
      });
    }
  };
}

/**
 * Returns a Fastify preHandler that enforces multi-tenant hierarchy.
 * Continental users can access everything.
 * Member state users cannot access other tenants.
 * REC users pass through (service layer validates child relationship).
 */
export function tenantHook() {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    const user = request.user as AuthenticatedUser | undefined;
    if (!user) {
      return reply.code(403).send({
        statusCode: 403,
        message: 'User not authenticated',
      });
    }

    // Continental level (AU-IBAR) can access everything
    if (user.tenantLevel === TenantLevel.CONTINENTAL) {
      return;
    }

    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    const requestedTenantId = params['tenantId'] ?? query['tenantId'];

    // No specific tenant requested — scope to own
    if (!requestedTenantId) {
      return;
    }

    // User can always access their own tenant
    if (requestedTenantId === user.tenantId) {
      return;
    }

    // Member state cannot access other tenants
    if (user.tenantLevel === TenantLevel.MEMBER_STATE) {
      request.log.warn(
        `Member state user ${user.userId} attempted to access tenant ${requestedTenantId}`,
      );
      return reply.code(403).send({
        statusCode: 403,
        message: 'Member state users cannot access other tenants',
      });
    }

    // REC users: allow through, service layer validates child relationship
    if (user.tenantLevel === TenantLevel.REC) {
      return;
    }

    return reply.code(403).send({
      statusCode: 403,
      message: 'Unauthorized tenant access',
    });
  };
}

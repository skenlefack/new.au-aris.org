import type { FastifyRequest, FastifyReply } from 'fastify';
import * as jwt from 'jsonwebtoken';
import type {
  JwtPayload,
  AuthenticatedUser,
} from '../interfaces/jwt-payload.interface';

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}

export interface AuthHookOptions {
  publicKey: string;
  algorithms?: jwt.Algorithm[];
  isTokenBlacklisted?: (token: string) => Promise<boolean>;
}

/**
 * Returns a Fastify onRequest hook that verifies JWT RS256 tokens
 * and populates `request.user` with the authenticated user context.
 */
export function authHook(options: AuthHookOptions) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    const authHeader = request.headers['authorization'];
    if (!authHeader) {
      return reply.code(401).send({
        statusCode: 401,
        message: 'Missing authorization header',
      });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return reply.code(401).send({
        statusCode: 401,
        message: 'Invalid authorization header format',
      });
    }

    const token = parts[1];

    try {
      const payload = jwt.verify(token, options.publicKey, {
        algorithms: options.algorithms ?? ['RS256'],
      }) as JwtPayload;

      if (options.isTokenBlacklisted) {
        if (await options.isTokenBlacklisted(token)) {
          return reply.code(401).send({
            statusCode: 401,
            message: 'Token has been revoked',
          });
        }
      }

      const user: AuthenticatedUser = {
        userId: payload.sub,
        email: payload.email,
        role: payload.role,
        tenantId: payload.tenantId,
        tenantLevel: payload.tenantLevel,
        locale: payload.locale,
      };

      request.user = user;
    } catch (error) {
      request.log.warn(
        `JWT verification failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return reply.code(401).send({
        statusCode: 401,
        message: 'Invalid or expired token',
      });
    }
  };
}

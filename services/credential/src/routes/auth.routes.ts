import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { rolesHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  LoginSchema,
  RegisterSchema,
  RefreshSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  type LoginInput,
  type RegisterInput,
  type RefreshInput,
  type ForgotPasswordInput,
  type ResetPasswordInput,
} from '../schemas/auth.schemas.js';

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/v1/credential/auth/login — rate limited, public
  app.post<{ Body: LoginInput }>('/api/v1/credential/auth/login', {
    schema: { body: LoginSchema },
    preHandler: [rateLimitHook(app, 10, 60)],
  }, async (request, reply) => {
    const result = await app.authService.login(request.body);
    return reply.code(200).send(result);
  });

  // POST /api/v1/credential/auth/register — auth + roles
  app.post<{ Body: RegisterInput }>('/api/v1/credential/auth/register', {
    schema: { body: RegisterSchema },
    preHandler: [
      app.authHookFn,
      rolesHook(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN, UserRole.REC_ADMIN, UserRole.NATIONAL_ADMIN),
    ],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.authService.register(request.body, user);
    return reply.code(201).send(result);
  });

  // POST /api/v1/credential/auth/refresh — rate limited, public
  app.post<{ Body: RefreshInput }>('/api/v1/credential/auth/refresh', {
    schema: { body: RefreshSchema },
    preHandler: [rateLimitHook(app, 10, 60)],
  }, async (request, reply) => {
    const result = await app.authService.refresh(request.body.refreshToken);
    return reply.code(200).send(result);
  });

  // POST /api/v1/credential/auth/forgot-password — rate limited, public
  app.post<{ Body: ForgotPasswordInput }>('/api/v1/credential/auth/forgot-password', {
    schema: { body: ForgotPasswordSchema },
    preHandler: [rateLimitHook(app, 5, 60)],
  }, async (request, reply) => {
    const protocol = request.headers['x-forwarded-proto'] ?? 'http';
    const host = request.headers['x-forwarded-host'] ?? request.headers['host'] ?? 'localhost';
    const baseUrl = `${protocol}://${host}`;
    const result = await app.authService.forgotPassword(request.body.email, baseUrl);
    return reply.code(200).send(result);
  });

  // POST /api/v1/credential/auth/reset-password — rate limited, public
  app.post<{ Body: ResetPasswordInput }>('/api/v1/credential/auth/reset-password', {
    schema: { body: ResetPasswordSchema },
    preHandler: [rateLimitHook(app, 5, 60)],
  }, async (request, reply) => {
    const result = await app.authService.resetPassword(request.body.token, request.body.newPassword);
    return reply.code(200).send(result);
  });

  // POST /api/v1/credential/auth/logout — auth required
  app.post('/api/v1/credential/auth/logout', {
    preHandler: [app.authHookFn],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const authHeader = request.headers['authorization'];
    const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    const result = await app.authService.logout(user.userId, accessToken);
    return reply.code(200).send(result);
  });
}

function rateLimitHook(app: FastifyInstance, max: number, windowSeconds: number) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    const ip = request.headers['x-forwarded-for']
      ? String(request.headers['x-forwarded-for']).split(',')[0].trim()
      : request.ip;
    const key = `ratelimit:${ip}:${request.routeOptions.url}`;
    const count = await app.redis.incr(key);
    if (count === 1) {
      await app.redis.expire(key, windowSeconds);
    }
    if (count > max) {
      const ttl = await app.redis.ttl(key);
      reply.header('Retry-After', ttl > 0 ? ttl : windowSeconds);
      return reply.code(429).send({
        statusCode: 429,
        message: 'Too many requests, please try again later',
      });
    }
  };
}

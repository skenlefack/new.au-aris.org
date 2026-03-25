import type { FastifyInstance } from 'fastify';
import { rolesHook, tenantHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  UpdateUserSchema,
  UpdateProfileSchema,
  UpdateLocaleSchema,
  PaginationQuerySchema,
  UuidParamSchema,
  type UpdateUserInput,
  type UpdateProfileInput,
  type UpdateLocaleInput,
  type PaginationQueryInput,
  type UuidParamInput,
} from '../schemas/user.schemas.js';

export async function registerUserRoutes(app: FastifyInstance): Promise<void> {
  const authAndTenant = [app.authHookFn, tenantHook()];

  // GET /api/v1/credential/users
  app.get<{ Querystring: PaginationQueryInput }>('/api/v1/credential/users', {
    schema: { querystring: PaginationQuerySchema },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.userService.findAll(user, request.query);
  });

  // GET /api/v1/credential/users/me
  app.get('/api/v1/credential/users/me', {
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.userService.findMe(user);
  });

  // PATCH /api/v1/credential/users/me — self-update profile
  app.patch<{ Body: UpdateProfileInput }>('/api/v1/credential/users/me', {
    schema: { body: UpdateProfileSchema },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.userService.updateMe(user, request.body);
  });

  // PUT /api/v1/credential/users/me/locale
  app.put<{ Body: UpdateLocaleInput }>('/api/v1/credential/users/me/locale', {
    schema: { body: UpdateLocaleSchema },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.userService.updateLocale(user.userId, request.body.locale);
  });

  // PATCH /api/v1/credential/users/:id
  app.patch<{ Params: UuidParamInput; Body: UpdateUserInput }>('/api/v1/credential/users/:id', {
    schema: { params: UuidParamSchema, body: UpdateUserSchema },
    preHandler: [
      ...authAndTenant,
      rolesHook(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN, UserRole.REC_ADMIN, UserRole.NATIONAL_ADMIN),
    ],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.userService.update(request.params.id, request.body, user);
  });

  // DELETE /api/v1/credential/users/:id — hard-delete users who never logged in
  app.delete<{ Params: UuidParamInput }>('/api/v1/credential/users/:id', {
    schema: { params: UuidParamSchema },
    preHandler: [
      ...authAndTenant,
      rolesHook(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN, UserRole.REC_ADMIN, UserRole.NATIONAL_ADMIN),
    ],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.userService.delete(request.params.id, user);
  });
}

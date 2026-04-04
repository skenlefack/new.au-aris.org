import type { FastifyInstance } from 'fastify';
import { rolesHook } from '@aris/auth-middleware/fastify';
import { Type, type Static } from '@sinclair/typebox';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  SendNotificationSchema,
  ListNotificationsQuerySchema,
  UuidParamSchema,
  type SendNotificationInput,
  type ListNotificationsQueryInput,
  type UuidParamInput,
} from '../schemas/notification.schema';

const TestEmailSchema = Type.Object({ to: Type.String({ format: 'email' }) });
type TestEmailInput = Static<typeof TestEmailSchema>;

export async function registerNotificationRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/v1/messages -- list notifications
  app.get<{ Querystring: ListNotificationsQueryInput }>('/api/v1/messages', {
    schema: { querystring: ListNotificationsQuerySchema },
    preHandler: [app.authHookFn],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.notificationService.findAll(user.userId, user.tenantId, request.query);
  });

  // GET /api/v1/messages/unread-count
  app.get('/api/v1/messages/unread-count', {
    preHandler: [app.authHookFn],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.notificationService.getUnreadCount(user.userId, user.tenantId);
  });

  // PATCH /api/v1/messages/:id/read
  app.patch<{ Params: UuidParamInput }>('/api/v1/messages/:id/read', {
    schema: { params: UuidParamSchema },
    preHandler: [app.authHookFn],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.notificationService.markAsRead(request.params.id, user.userId, user.tenantId);
  });

  // POST /api/v1/messages/mark-all-read
  app.post('/api/v1/messages/mark-all-read', {
    preHandler: [app.authHookFn],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.notificationService.markAllAsRead(user.userId, user.tenantId);
  });

  // POST /api/v1/messages/send
  app.post<{ Body: SendNotificationInput }>('/api/v1/messages/send', {
    schema: { body: SendNotificationSchema },
    preHandler: [
      app.authHookFn,
      rolesHook(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN, UserRole.REC_ADMIN, UserRole.NATIONAL_ADMIN),
    ],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.notificationService.sendManual(request.body, user);
  });

  // POST /api/v1/messages/test-email — send a test email to verify provider (admin only)
  app.post<{ Body: TestEmailInput }>('/api/v1/messages/test-email', {
    schema: { body: TestEmailSchema },
    preHandler: [
      app.authHookFn,
      rolesHook(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN, UserRole.REC_ADMIN, UserRole.NATIONAL_ADMIN),
    ],
  }, async (request) => {
    return app.notificationService.testEmail(request.body.to);
  });
}

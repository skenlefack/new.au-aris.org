import type { FastifyInstance } from 'fastify';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { UpsertPreferenceSchema, type UpsertPreferenceInput } from '../schemas/preference.schema';

export async function registerPreferencesRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/v1/messages/preferences
  app.get('/api/v1/messages/preferences', {
    preHandler: [app.authHookFn],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.preferencesService.findAll(user.userId, user.tenantId);
  });

  // POST /api/v1/messages/preferences
  app.post<{ Body: UpsertPreferenceInput }>('/api/v1/messages/preferences', {
    schema: { body: UpsertPreferenceSchema },
    preHandler: [app.authHookFn],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.preferencesService.upsert(request.body, user);
  });
}

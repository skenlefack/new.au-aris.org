import type { FastifyInstance } from 'fastify';
import { rolesHook, tenantHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

export async function registerOnboardingRoutes(app: FastifyInstance): Promise<void> {
  const authAndTenant = [app.authHookFn, tenantHook()];

  // ─── Public: submit onboarding request (no auth required) ────────

  app.post('/api/v1/public/onboarding', async (request, reply) => {
    const body = request.body as Record<string, unknown>;

    // Basic validation
    const required = ['countryName', 'preferredLanguage', 'adminLevels', 'activeDomains', 'contactFullName', 'contactTitle', 'contactInstitution', 'contactEmail', 'contactPhone'];
    const missing = required.filter((f) => !body[f]);
    if (missing.length > 0) {
      return reply.code(400).send({
        statusCode: 400,
        message: 'Missing required fields',
        errors: missing.map((f) => ({ field: f, message: `${f} is required` })),
      });
    }

    const result = await app.onboardingService.submitOnboarding(body);
    return reply.code(201).send(result);
  });

  // ─── Admin: list onboarding submissions ──────────────────────────

  app.get('/api/v1/settings/onboarding', {
    preHandler: [...authAndTenant, rolesHook(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN, UserRole.REC_ADMIN, UserRole.NATIONAL_ADMIN)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.onboardingService.listOnboardings(request.query as Record<string, unknown>, user);
  });

  // ─── Admin: get single onboarding ────────────────────────────────

  app.get<{ Params: { id: string } }>('/api/v1/settings/onboarding/:id', {
    preHandler: [...authAndTenant, rolesHook(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN, UserRole.REC_ADMIN, UserRole.NATIONAL_ADMIN)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.onboardingService.getOnboarding(request.params.id, user);
  });

  // ─── Admin: update onboarding submission ─────────────────────────

  app.put<{ Params: { id: string } }>('/api/v1/settings/onboarding/:id', {
    preHandler: [...authAndTenant, rolesHook(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN, UserRole.REC_ADMIN, UserRole.NATIONAL_ADMIN)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.onboardingService.updateOnboarding(request.params.id, request.body as Record<string, unknown>, user);
  });

  // ─── Admin: update status ────────────────────────────────────────

  app.patch<{ Params: { id: string } }>('/api/v1/settings/onboarding/:id/status', {
    preHandler: [...authAndTenant, rolesHook(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    const body = request.body as Record<string, unknown>;
    return app.onboardingService.updateStatus(request.params.id, body.status as string, (body.notes as string) ?? null, user);
  });

  // ─── Admin: auto-provision users from onboarding ─────────────────

  app.post<{ Params: { id: string } }>('/api/v1/settings/onboarding/:id/provision-users', {
    preHandler: [...authAndTenant, rolesHook(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.onboardingService.provisionUsers(request.params.id, user);
  });

  // ─── Admin: delete onboarding ────────────────────────────────────

  app.delete<{ Params: { id: string } }>('/api/v1/settings/onboarding/:id', {
    preHandler: [...authAndTenant, rolesHook(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.onboardingService.deleteOnboarding(request.params.id, user);
  });
}

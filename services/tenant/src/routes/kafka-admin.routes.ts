import type { FastifyInstance } from 'fastify';
import { rolesHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';

export async function registerKafkaAdminRoutes(app: FastifyInstance): Promise<void> {
  const superAdminOnly = [app.authHookFn, rolesHook(UserRole.SUPER_ADMIN)];

  // GET /api/v1/admin/kafka/health — Full consumer health snapshot
  app.get('/api/v1/admin/kafka/health', { preHandler: superAdminOnly }, async () => {
    const summary = await (app as any).kafkaHealthService.getHealth();
    return { data: summary };
  });

  // GET /api/v1/admin/kafka/alert-recipients
  app.get('/api/v1/admin/kafka/alert-recipients', { preHandler: superAdminOnly }, async () => {
    const recipients = await (app as any).kafkaHealthService.getAlertRecipients();
    return { data: { recipients } };
  });

  // PUT /api/v1/admin/kafka/alert-recipients
  app.put('/api/v1/admin/kafka/alert-recipients', { preHandler: superAdminOnly }, async (request) => {
    const { recipients } = request.body as { recipients: string[] };
    if (!Array.isArray(recipients)) {
      return { statusCode: 400, message: 'recipients must be an array of email addresses' };
    }
    // Basic email validation
    const valid = recipients.filter(r => typeof r === 'string' && r.includes('@'));
    await (app as any).kafkaHealthService.setAlertRecipients(valid);
    return { data: { recipients: valid } };
  });

  // POST /api/v1/admin/kafka/restart-service
  app.post('/api/v1/admin/kafka/restart-service', { preHandler: superAdminOnly }, async (request, reply) => {
    const { serviceName } = request.body as { serviceName: string };
    if (!serviceName || typeof serviceName !== 'string') {
      return reply.code(400).send({ statusCode: 400, message: 'serviceName is required' });
    }
    const result = await (app as any).kafkaHealthService.restartService(serviceName);
    return { data: result };
  });

  // POST /api/v1/admin/kafka/test-alert — Send test alert email
  app.post('/api/v1/admin/kafka/test-alert', { preHandler: superAdminOnly }, async (_request, reply) => {
    const success = await (app as any).kafkaHealthService.sendTestAlert();
    if (!success) {
      return reply.code(400).send({
        statusCode: 400,
        message: 'Failed to send test alert. Check that alert recipients are configured and POSTMARK_SERVER_TOKEN is set.',
      });
    }
    return { data: { success: true } };
  });
}

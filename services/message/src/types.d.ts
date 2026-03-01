import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import type { authHook } from '@aris/auth-middleware/fastify';
import type { NotificationService } from './services/notification.service';
import type { PreferencesService } from './services/preferences.service';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    kafka: StandaloneKafkaProducer;
    notificationService: NotificationService;
    preferencesService: PreferencesService;
    authHookFn: ReturnType<typeof authHook>;
  }
}

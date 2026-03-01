import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { StandaloneKafkaConsumer } from '@aris/kafka-client';
import { NotificationConsumer } from '../consumers/notification.consumer';
import { TemplateEngine } from '../services/template-engine';
import { PreferencesService } from '../services/preferences.service';

export default fp(
  async (app: FastifyInstance) => {
    const kafkaConsumer = new StandaloneKafkaConsumer({
      clientId: process.env['KAFKA_CLIENT_ID'] ?? 'aris-message-service',
      brokers: (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(','),
    });

    const templateEngine = new TemplateEngine();
    const preferencesService = new PreferencesService(app.prisma);

    const consumer = new NotificationConsumer(
      kafkaConsumer,
      app.notificationService,
      templateEngine,
      preferencesService,
    );

    // Start consumer after app is ready
    app.ready().then(() => {
      consumer.start().catch((err) => {
        app.log.warn(`Kafka consumer start failed: ${err}`);
      });
    });

    app.addHook('onClose', async () => {
      await consumer.stop();
    });
  },
  { name: 'kafka-consumers', dependencies: ['prisma', 'kafka', 'scheduler'] },
);

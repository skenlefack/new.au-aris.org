import fp from 'fastify-plugin';
import { StandaloneKafkaProducer } from '@aris/kafka-client';
import type { FastifyInstance } from 'fastify';

export default fp(
  async (app: FastifyInstance) => {
    const kafka = new StandaloneKafkaProducer({
      clientId: process.env['KAFKA_CLIENT_ID'] ?? 'aris-message-service',
      brokers: (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(','),
    });

    try {
      await kafka.connect();
      app.log.info('Kafka producer connected');
    } catch (err) {
      app.log.warn(`Kafka connect failed, events will be unavailable: ${err}`);
    }

    app.decorate('kafka', kafka);

    app.addHook('onClose', async () => {
      await kafka.disconnect();
    });
  },
  { name: 'kafka' },
);

import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { StandaloneKafkaProducer } from '../standalone-producer';
import { StandaloneKafkaConsumer } from '../standalone-consumer';
import type { StandaloneConsumeOptions, StandaloneMessageHandler } from '../standalone-consumer';
import type { KafkaConfig } from '../kafka.config';
import type { KafkaHeaders, KafkaEvent } from '@aris/shared-types';

export interface KafkaPluginOptions extends KafkaConfig {}

export interface FastifyKafka {
  producer: StandaloneKafkaProducer;
  consumer: StandaloneKafkaConsumer;
  publish<T>(event: KafkaEvent<T>): Promise<void>;
  send<T>(topic: string, key: string, payload: T, headers: KafkaHeaders): Promise<void>;
  subscribe(options: StandaloneConsumeOptions, handler: StandaloneMessageHandler): Promise<void>;
}

declare module 'fastify' {
  interface FastifyInstance {
    kafka: FastifyKafka;
  }
}

/**
 * Fastify plugin that provides Kafka producer + consumer on `app.kafka`.
 * Usage: `app.register(fastifyKafka, { clientId: '...', brokers: ['...'] })`
 */
export default fp<KafkaPluginOptions>(
  async (app: FastifyInstance, opts: KafkaPluginOptions) => {
    const producer = new StandaloneKafkaProducer(opts);
    const consumer = new StandaloneKafkaConsumer(opts);

    await producer.connect();

    const kafka: FastifyKafka = {
      producer,
      consumer,
      async publish<T>(event: KafkaEvent<T>) {
        await producer.publish(event);
      },
      async send<T>(topic: string, key: string, payload: T, headers: KafkaHeaders) {
        await producer.send(topic, key, payload, headers);
      },
      async subscribe(options: StandaloneConsumeOptions, handler: StandaloneMessageHandler) {
        await consumer.subscribe(options, handler);
      },
    };

    app.decorate('kafka', kafka);

    app.addHook('onClose', async () => {
      await consumer.disconnectAll();
      await producer.disconnect();
    });
  },
  {
    name: '@aris/fastify-kafka',
    fastify: '5.x',
  },
);

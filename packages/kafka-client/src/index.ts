export { KafkaModule } from './kafka.module';
export { KafkaProducerService } from './kafka-producer.service';
export { KafkaConsumerService } from './kafka-consumer.service';
export type { ConsumeOptions, MessageHandler } from './kafka-consumer.service';
export type { KafkaConfig } from './kafka.config';
export { DEFAULT_KAFKA_CONFIG, KAFKA_CONFIG_TOKEN, KAFKA_INSTANCE_TOKEN } from './kafka.config';
export { KafkaSubscribe, KAFKA_SUBSCRIBE_METADATA } from './decorators/kafka-subscribe.decorator';
export type { KafkaSubscribeOptions } from './decorators/kafka-subscribe.decorator';

// Standalone (no NestJS)
export { StandaloneKafkaProducer } from './standalone-producer';
export { StandaloneKafkaConsumer } from './standalone-consumer';
export type { StandaloneConsumeOptions, StandaloneMessageHandler } from './standalone-consumer';

// Fastify plugin
export { fastifyKafka } from './fastify';
export type { KafkaPluginOptions, FastifyKafka } from './fastify';

// Event-driven architecture
export * from './events';

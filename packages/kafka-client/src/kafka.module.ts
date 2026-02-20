import { DynamicModule, Module, Global } from '@nestjs/common';
import { Kafka, logLevel, type SASLOptions } from 'kafkajs';
import {
  KafkaConfig,
  DEFAULT_KAFKA_CONFIG,
  KAFKA_CONFIG_TOKEN,
  KAFKA_INSTANCE_TOKEN,
} from './kafka.config';
import { KafkaProducerService } from './kafka-producer.service';
import { KafkaConsumerService } from './kafka-consumer.service';

@Global()
@Module({})
export class KafkaModule {
  static forRoot(config: KafkaConfig): DynamicModule {
    const mergedConfig: KafkaConfig = {
      ...DEFAULT_KAFKA_CONFIG,
      ...config,
      retry: { ...DEFAULT_KAFKA_CONFIG.retry!, ...config.retry },
      producer: { ...DEFAULT_KAFKA_CONFIG.producer!, ...config.producer },
      consumer: { ...DEFAULT_KAFKA_CONFIG.consumer!, ...config.consumer },
    };

    const kafkaInstance = new Kafka({
      clientId: mergedConfig.clientId,
      brokers: mergedConfig.brokers,
      ssl: mergedConfig.ssl,
      sasl: mergedConfig.sasl
        ? ({
            mechanism: mergedConfig.sasl.mechanism,
            username: mergedConfig.sasl.username,
            password: mergedConfig.sasl.password,
          } as SASLOptions)
        : undefined,
      retry: {
        retries: mergedConfig.retry?.maxRetries ?? 5,
        initialRetryTime: mergedConfig.retry?.initialRetryTime ?? 300,
        maxRetryTime: mergedConfig.retry?.maxRetryTime ?? 30000,
        factor: mergedConfig.retry?.factor ?? 2,
      },
      logLevel: logLevel.WARN,
    });

    return {
      module: KafkaModule,
      providers: [
        {
          provide: KAFKA_CONFIG_TOKEN,
          useValue: mergedConfig,
        },
        {
          provide: KAFKA_INSTANCE_TOKEN,
          useValue: kafkaInstance,
        },
        KafkaProducerService,
        KafkaConsumerService,
      ],
      exports: [
        KafkaProducerService,
        KafkaConsumerService,
        KAFKA_CONFIG_TOKEN,
        KAFKA_INSTANCE_TOKEN,
      ],
    };
  }
}

import { SetMetadata } from '@nestjs/common';

export const KAFKA_SUBSCRIBE_METADATA = 'ARIS_KAFKA_SUBSCRIBE';

export interface KafkaSubscribeOptions {
  topic: string;
  groupId: string;
  fromBeginning?: boolean;
  maxRetries?: number;
  dlqTopic?: string;
}

export function KafkaSubscribe(options: KafkaSubscribeOptions): MethodDecorator {
  return SetMetadata(KAFKA_SUBSCRIBE_METADATA, options);
}

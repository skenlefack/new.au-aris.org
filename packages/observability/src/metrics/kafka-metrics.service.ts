import { Injectable } from '@nestjs/common';
import * as client from 'prom-client';

const PREFIX = 'aris_kafka_';

@Injectable()
export class KafkaMetricsService {
  private readonly messagesProduced = new client.Counter({
    name: `${PREFIX}messages_produced_total`,
    help: 'Total Kafka messages produced',
    labelNames: ['topic'] as const,
  });

  private readonly messagesConsumed = new client.Counter({
    name: `${PREFIX}messages_consumed_total`,
    help: 'Total Kafka messages consumed',
    labelNames: ['topic', 'group'] as const,
  });

  private readonly messagesFailed = new client.Counter({
    name: `${PREFIX}messages_failed_total`,
    help: 'Total Kafka messages that failed processing',
    labelNames: ['topic', 'group'] as const,
  });

  private readonly consumerLag = new client.Gauge({
    name: `${PREFIX}consumer_lag`,
    help: 'Kafka consumer lag (messages behind)',
    labelNames: ['topic', 'group', 'partition'] as const,
  });

  private readonly produceDuration = new client.Histogram({
    name: `${PREFIX}produce_duration_seconds`,
    help: 'Time to produce a Kafka message',
    labelNames: ['topic'] as const,
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  });

  recordMessageProduced(topic: string): void {
    this.messagesProduced.inc({ topic });
  }

  startProduceTimer(topic: string): () => void {
    const end = this.produceDuration.startTimer({ topic });
    return () => end();
  }

  recordMessageConsumed(topic: string, group: string): void {
    this.messagesConsumed.inc({ topic, group });
  }

  recordMessageFailed(topic: string, group: string): void {
    this.messagesFailed.inc({ topic, group });
  }

  setConsumerLag(
    topic: string,
    group: string,
    partition: number,
    lag: number,
  ): void {
    this.consumerLag.set({ topic, group, partition: String(partition) }, lag);
  }
}

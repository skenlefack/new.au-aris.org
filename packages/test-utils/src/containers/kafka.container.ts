import { GenericContainer, Wait } from 'testcontainers';
import type { StartedTestContainer } from 'testcontainers';

export interface KafkaContainerResult {
  container: StartedTestContainer;
  brokerUrl: string;
  host: string;
  port: number;
}

/**
 * Start an Apache Kafka container (KRaft mode) for integration tests.
 *
 * Uses confluentinc/cp-kafka with KRaft (no ZooKeeper).
 *
 * Usage:
 * ```typescript
 * const kafka = await startKafkaContainer();
 * // use kafka.brokerUrl with KafkaJS
 * await kafka.container.stop();
 * ```
 */
export async function startKafkaContainer(options?: {
  image?: string;
}): Promise<KafkaContainerResult> {
  const image = options?.image ?? 'confluentinc/cp-kafka:7.6.0';

  const container = await new GenericContainer(image)
    .withExposedPorts(9092)
    .withEnvironment({
      KAFKA_NODE_ID: '1',
      KAFKA_PROCESS_ROLES: 'broker,controller',
      KAFKA_CONTROLLER_QUORUM_VOTERS: '1@localhost:9093',
      KAFKA_LISTENERS: 'PLAINTEXT://0.0.0.0:9092,CONTROLLER://0.0.0.0:9093',
      KAFKA_ADVERTISED_LISTENERS: 'PLAINTEXT://localhost:9092',
      KAFKA_CONTROLLER_LISTENER_NAMES: 'CONTROLLER',
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP:
        'PLAINTEXT:PLAINTEXT,CONTROLLER:PLAINTEXT',
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: '1',
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: '1',
      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: '1',
      CLUSTER_ID: 'dGVzdC1jbHVzdGVyLWlk',
    })
    .withWaitStrategy(Wait.forLogMessage(/started.*broker/i))
    .start();

  const host = container.getHost();
  const port = container.getMappedPort(9092);
  const brokerUrl = `${host}:${port}`;

  return { container, brokerUrl, host, port };
}

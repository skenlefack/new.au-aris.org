import {
  startPostgresContainer,
  startKafkaContainer,
  startRedisContainer,
  type PostgresContainerResult,
  type KafkaContainerResult,
  type RedisContainerResult,
} from '@aris/test-utils';

export interface TestInfrastructure {
  postgres: PostgresContainerResult;
  kafka: KafkaContainerResult;
  redis: RedisContainerResult;
}

export interface PartialTestInfrastructure {
  postgres?: PostgresContainerResult;
  kafka?: KafkaContainerResult;
  redis?: RedisContainerResult;
}

/**
 * Starts all three infrastructure containers in parallel.
 * Use in beforeAll() for cross-service integration tests.
 */
export async function startAllContainers(): Promise<TestInfrastructure> {
  const [postgres, kafka, redis] = await Promise.all([
    startPostgresContainer(),
    startKafkaContainer(),
    startRedisContainer(),
  ]);

  return { postgres, kafka, redis };
}

/**
 * Starts only PostgreSQL and Kafka containers.
 */
export async function startPgAndKafka(): Promise<Pick<TestInfrastructure, 'postgres' | 'kafka'>> {
  const [postgres, kafka] = await Promise.all([
    startPostgresContainer(),
    startKafkaContainer(),
  ]);

  return { postgres, kafka };
}

/**
 * Starts only PostgreSQL and Redis containers.
 */
export async function startPgAndRedis(): Promise<Pick<TestInfrastructure, 'postgres' | 'redis'>> {
  const [postgres, redis] = await Promise.all([
    startPostgresContainer(),
    startRedisContainer(),
  ]);

  return { postgres, redis };
}

/**
 * Stops all containers in the infrastructure.
 */
export async function stopAllContainers(infra: PartialTestInfrastructure): Promise<void> {
  const stopPromises: Promise<void>[] = [];

  if (infra.postgres) stopPromises.push(infra.postgres.container.stop().then(() => {}));
  if (infra.kafka) stopPromises.push(infra.kafka.container.stop().then(() => {}));
  if (infra.redis) stopPromises.push(infra.redis.container.stop().then(() => {}));

  await Promise.all(stopPromises);
}

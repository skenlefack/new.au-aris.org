import { GenericContainer, Wait } from 'testcontainers';
import type { StartedTestContainer } from 'testcontainers';

export interface RedisContainerResult {
  container: StartedTestContainer;
  redisUrl: string;
  host: string;
  port: number;
}

/**
 * Start a Redis 7 container for integration tests.
 *
 * Usage:
 * ```typescript
 * const redis = await startRedisContainer();
 * const client = new Redis(redis.redisUrl);
 * await redis.container.stop();
 * ```
 */
export async function startRedisContainer(options?: {
  image?: string;
}): Promise<RedisContainerResult> {
  const image = options?.image ?? 'redis:7-alpine';

  const container = await new GenericContainer(image)
    .withExposedPorts(6379)
    .withWaitStrategy(Wait.forLogMessage('Ready to accept connections'))
    .start();

  const host = container.getHost();
  const port = container.getMappedPort(6379);
  const redisUrl = `redis://${host}:${port}`;

  return { container, redisUrl, host, port };
}

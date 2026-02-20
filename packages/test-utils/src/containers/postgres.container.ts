import { GenericContainer, Wait } from 'testcontainers';
import type { StartedTestContainer } from 'testcontainers';

export interface PostgresContainerResult {
  container: StartedTestContainer;
  databaseUrl: string;
  host: string;
  port: number;
}

/**
 * Start a PostgreSQL 16 container for integration tests.
 *
 * Usage:
 * ```typescript
 * const pg = await startPostgresContainer();
 * // use pg.databaseUrl with Prisma or raw client
 * await pg.container.stop();
 * ```
 */
export async function startPostgresContainer(options?: {
  database?: string;
  username?: string;
  password?: string;
  image?: string;
}): Promise<PostgresContainerResult> {
  const database = options?.database ?? 'aris_test';
  const username = options?.username ?? 'aris';
  const password = options?.password ?? 'aris';
  const image = options?.image ?? 'postgres:16-alpine';

  const container = await new GenericContainer(image)
    .withExposedPorts(5432)
    .withEnvironment({
      POSTGRES_USER: username,
      POSTGRES_PASSWORD: password,
      POSTGRES_DB: database,
    })
    .withWaitStrategy(
      Wait.forLogMessage('database system is ready to accept connections'),
    )
    .start();

  const host = container.getHost();
  const port = container.getMappedPort(5432);
  const databaseUrl = `postgresql://${username}:${password}@${host}:${port}/${database}`;

  return { container, databaseUrl, host, port };
}

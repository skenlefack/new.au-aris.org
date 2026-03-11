import { describe, it, expect, afterAll } from 'vitest';
import { startPostgresContainer, type PostgresContainerResult } from '../postgres.container';

describe('startPostgresContainer', () => {
  let pg: PostgresContainerResult | undefined;

  afterAll(async () => {
    if (pg) {
      await pg.container.stop();
    }
  });

  it('should start a PostgreSQL container and return connection details', async () => {
    pg = await startPostgresContainer();

    expect(pg.container).toBeDefined();
    expect(pg.databaseUrl).toContain('postgresql://');
    expect(pg.databaseUrl).toContain('aris_test');
    expect(pg.host).toBeDefined();
    expect(typeof pg.port).toBe('number');
    expect(pg.port).toBeGreaterThan(0);
  });

  it('should return a valid database URL format', async () => {
    // Reuse the container started in the previous test
    if (!pg) {
      pg = await startPostgresContainer();
    }

    const url = new URL(pg.databaseUrl);
    expect(url.protocol).toBe('postgresql:');
    expect(url.hostname).toBe(pg.host);
    expect(url.port).toBe(String(pg.port));
    expect(url.pathname).toBe('/aris_test');
  });
});

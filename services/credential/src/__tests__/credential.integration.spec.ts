import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GenericContainer, Wait } from 'testcontainers';
import type { StartedTestContainer } from 'testcontainers';
import { execSync } from 'child_process';
import { generateKeyPairSync } from 'crypto';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

/**
 * Integration test — starts real PG + Redis containers,
 * pushes the Prisma schema, then exercises the full
 * register → login → refresh → logout flow.
 */

// ── Generate RSA keys for JWT ──
const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

let pgContainer: StartedTestContainer;
let redisContainer: StartedTestContainer;
let prisma: PrismaClient;
let redis: Redis;
let databaseUrl: string;
let redisUrl: string;

describe('Credential Service — Integration', () => {
  beforeAll(async () => {
    // Start PostgreSQL container
    pgContainer = await new GenericContainer('postgres:16-alpine')
      .withExposedPorts(5432)
      .withEnvironment({
        POSTGRES_USER: 'aris',
        POSTGRES_PASSWORD: 'aris',
        POSTGRES_DB: 'aris_test',
      })
      .withWaitStrategy(Wait.forLogMessage('database system is ready to accept connections'))
      .start();

    const pgHost = pgContainer.getHost();
    const pgPort = pgContainer.getMappedPort(5432);
    databaseUrl = `postgresql://aris:aris@${pgHost}:${pgPort}/aris_test`;

    // Start Redis container
    redisContainer = await new GenericContainer('redis:7-alpine')
      .withExposedPorts(6379)
      .withWaitStrategy(Wait.forLogMessage('Ready to accept connections'))
      .start();

    const redisHost = redisContainer.getHost();
    const redisPort = redisContainer.getMappedPort(6379);
    redisUrl = `redis://${redisHost}:${redisPort}`;

    // Set env for Prisma + services
    process.env['DATABASE_URL'] = databaseUrl;
    process.env['REDIS_URL'] = redisUrl;
    process.env['JWT_PRIVATE_KEY'] = privateKey;
    process.env['JWT_PUBLIC_KEY'] = publicKey;

    // Push Prisma schema (creates tables)
    const schemaPath = require.resolve('@aris/db-schemas/prisma/schema.prisma').replace(/schema\.prisma$/, '');
    execSync(`npx prisma db push --schema=${schemaPath} --skip-generate --accept-data-loss`, {
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'pipe',
    });

    // Initialize clients
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await prisma.$connect();

    redis = new Redis(redisUrl, { lazyConnect: false });

    // Seed a tenant so register has a valid tenantId
    await prisma.tenant.create({
      data: {
        id: '00000000-0000-4000-a000-000000000001',
        name: 'African Union - IBAR',
        code: 'AU-IBAR',
        level: 'CONTINENTAL',
        domain: 'au-aris.org',
        config: {},
      },
    });
  }, 120_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    redis?.disconnect();
    await pgContainer?.stop();
    await redisContainer?.stop();
  }, 30_000);

  // Dynamically import AuthService to use env vars set above
  async function createAuthService() {
    const { AuthService } = await import('../auth/auth.service');
    const { RedisService } = await import('../redis.service');

    const redisService = {
      set: async (key: string, value: string, ttl?: number) => {
        if (ttl) await redis.set(key, value, 'EX', ttl);
        else await redis.set(key, value);
      },
      get: async (key: string) => redis.get(key),
      del: async (key: string) => redis.del(key),
      delPattern: async (pattern: string) => {
        const keys = await redis.keys(pattern);
        if (keys.length === 0) return 0;
        return redis.del(...keys);
      },
    };

    const kafkaProducer = {
      send: async () => [], // no-op in integration test
    };

    return new AuthService(
      prisma as never,
      redisService as never,
      kafkaProducer as never,
    );
  }

  it('full flow: register → login → refresh → logout', async () => {
    const authService = await createAuthService();

    // ── 1. Register ──
    const caller = {
      userId: 'admin-001',
      email: 'admin@au-aris.org',
      role: 'SUPER_ADMIN',
      tenantId: '00000000-0000-4000-a000-000000000001',
      tenantLevel: 'CONTINENTAL',
    };

    const registerResult = await authService.register(
      {
        email: 'integration@au-aris.org',
        password: 'IntTest2024!',
        firstName: 'Integration',
        lastName: 'Test',
        role: 'NATIONAL_ADMIN' as never,
        tenantId: '00000000-0000-4000-a000-000000000001',
      },
      caller as never,
    );

    expect(registerResult.data.email).toBe('integration@au-aris.org');
    expect(registerResult.data).not.toHaveProperty('passwordHash');

    // Verify user persisted in DB
    const dbUser = await prisma.user.findUnique({
      where: { email: 'integration@au-aris.org' },
    });
    expect(dbUser).not.toBeNull();
    expect(dbUser!.firstName).toBe('Integration');

    // ── 2. Login ──
    const loginResult = await authService.login({
      email: 'integration@au-aris.org',
      password: 'IntTest2024!',
    });

    expect(loginResult.data.accessToken).toBeDefined();
    expect(loginResult.data.refreshToken).toBeDefined();
    expect(loginResult.data.expiresIn).toBe(900);

    // Verify refresh token exists in Redis
    const keysAfterLogin = await redis.keys('refresh:*');
    expect(keysAfterLogin.length).toBeGreaterThanOrEqual(1);

    // ── 3. Refresh ──
    const refreshResult = await authService.refresh(loginResult.data.refreshToken);

    expect(refreshResult.data.accessToken).toBeDefined();
    expect(refreshResult.data.refreshToken).toBeDefined();
    // New refresh token should be different (rotation)
    expect(refreshResult.data.refreshToken).not.toBe(loginResult.data.refreshToken);

    // Old token should be gone, new one should exist
    const keysAfterRefresh = await redis.keys('refresh:*');
    expect(keysAfterRefresh.length).toBeGreaterThanOrEqual(1);

    // ── 4. Logout ──
    const logoutResult = await authService.logout(dbUser!.id);
    expect(logoutResult.data.message).toBe('Logged out successfully');

    // All refresh tokens should be cleared
    const keysAfterLogout = await redis.keys(`refresh:${dbUser!.id}:*`);
    expect(keysAfterLogout.length).toBe(0);

    // ── 5. Refresh with old token should fail ──
    await expect(
      authService.refresh(refreshResult.data.refreshToken),
    ).rejects.toThrow();
  });

  it('login with wrong password should fail', async () => {
    const authService = await createAuthService();

    await expect(
      authService.login({
        email: 'integration@au-aris.org',
        password: 'WrongPassword1',
      }),
    ).rejects.toThrow();
  });

  it('register duplicate email should fail', async () => {
    const authService = await createAuthService();

    const caller = {
      userId: 'admin-001',
      email: 'admin@au-aris.org',
      role: 'SUPER_ADMIN',
      tenantId: '00000000-0000-4000-a000-000000000001',
      tenantLevel: 'CONTINENTAL',
    };

    await expect(
      authService.register(
        {
          email: 'integration@au-aris.org', // already exists from first test
          password: 'AnotherPass1',
          firstName: 'Dup',
          lastName: 'Test',
          role: 'NATIONAL_ADMIN' as never,
          tenantId: '00000000-0000-4000-a000-000000000001',
        },
        caller as never,
      ),
    ).rejects.toThrow();
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { generateKeyPairSync } from 'crypto';
import { AuthService } from '../auth.service';
import { UserRole, TenantLevel } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

// ── Generate RSA key pair for tests ──

const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

// Set env before AuthService reads them in constructor
process.env['JWT_PRIVATE_KEY'] = privateKey;
process.env['JWT_PUBLIC_KEY'] = publicKey;

// ── Mock factories ──

function mockPrismaService() {
  return {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    tenant: {
      findUnique: vi.fn(),
    },
  };
}

function mockRedisService() {
  return {
    set: vi.fn().mockResolvedValue(undefined),
    get: vi.fn(),
    del: vi.fn().mockResolvedValue(1),
    delPattern: vi.fn().mockResolvedValue(3),
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    exists: vi.fn().mockResolvedValue(0),
  };
}

function mockKafkaProducer() {
  return {
    send: vi.fn().mockResolvedValue([]),
  };
}

function mockLockoutService() {
  return {
    isLocked: vi.fn().mockResolvedValue(false),
    recordFailedAttempt: vi.fn().mockResolvedValue(1),
    resetAttempts: vi.fn().mockResolvedValue(undefined),
  };
}

function callerUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    userId: 'caller-001',
    email: 'admin@aris.africa',
    role: UserRole.SUPER_ADMIN,
    tenantId: 'tenant-au',
    tenantLevel: TenantLevel.CONTINENTAL,
    ...overrides,
  };
}

function userFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-001',
    tenantId: 'tenant-ke',
    email: 'john@ke.aris.africa',
    passwordHash: '$2b$12$hashedpassword',
    firstName: 'John',
    lastName: 'Doe',
    role: UserRole.NATIONAL_ADMIN,
    mfaEnabled: false,
    mfaSecret: null,
    lastLoginAt: null,
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    tenant: { level: TenantLevel.MEMBER_STATE },
    ...overrides,
  };
}

// ── Tests ──

describe('AuthService', () => {
  let service: AuthService;
  let prisma: ReturnType<typeof mockPrismaService>;
  let redis: ReturnType<typeof mockRedisService>;
  let kafka: ReturnType<typeof mockKafkaProducer>;
  let lockout: ReturnType<typeof mockLockoutService>;

  beforeEach(() => {
    prisma = mockPrismaService();
    redis = mockRedisService();
    kafka = mockKafkaProducer();
    lockout = mockLockoutService();
    service = new AuthService(
      prisma as never,
      redis as never,
      kafka as never,
      lockout as never,
    );
  });

  // ── register ──

  describe('register', () => {
    const registerDto = {
      email: 'john@ke.aris.africa',
      password: 'StrongPass1',
      firstName: 'John',
      lastName: 'Doe',
      role: UserRole.NATIONAL_ADMIN,
      tenantId: 'tenant-ke',
    };

    it('should register a new user and return safe user (no passwordHash)', async () => {
      prisma.user.findUnique.mockResolvedValue(null); // no duplicate
      prisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-ke' }); // tenant exists
      prisma.user.create.mockResolvedValue(userFixture());

      const result = await service.register(registerDto, callerUser());

      expect(result.data).toBeDefined();
      expect(result.data.email).toBe('john@ke.aris.africa');
      expect(result.data).not.toHaveProperty('passwordHash');
      expect(result.data).not.toHaveProperty('mfaSecret');
      expect(prisma.user.create).toHaveBeenCalledOnce();

      // Verify bcrypt was used (password hashed in create data)
      const createCall = prisma.user.create.mock.calls[0][0];
      expect(createCall.data.passwordHash).toBeDefined();
      expect(createCall.data.passwordHash).not.toBe(registerDto.password);
    });

    it('should throw ConflictException if email already exists', async () => {
      prisma.user.findUnique.mockResolvedValue(userFixture());

      await expect(
        service.register(registerDto, callerUser()),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException if tenant does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.tenant.findUnique.mockResolvedValue(null);

      await expect(
        service.register(registerDto, callerUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should publish Kafka event on successful registration', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-ke' });
      prisma.user.create.mockResolvedValue(userFixture());

      await service.register(registerDto, callerUser());

      expect(kafka.send).toHaveBeenCalledWith(
        'sys.credential.user.created.v1',
        'user-001',
        expect.objectContaining({ email: 'john@ke.aris.africa' }),
        expect.objectContaining({ sourceService: 'credential-service' }),
      );
    });

    it('should not fail if Kafka publish errors', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-ke' });
      prisma.user.create.mockResolvedValue(userFixture());
      kafka.send.mockRejectedValue(new Error('Kafka down'));

      const result = await service.register(registerDto, callerUser());
      expect(result.data).toBeDefined();
    });
  });

  // ── login ──

  describe('login', () => {
    const loginDto = { email: 'john@ke.aris.africa', password: 'StrongPass1' };

    it('should return access token + refresh token on valid credentials', async () => {
      const hashed = await bcrypt.hash('StrongPass1', 4); // fast rounds for test
      prisma.user.findUnique.mockResolvedValue(
        userFixture({ passwordHash: hashed }),
      );

      const result = await service.login(loginDto);

      expect(result.data.accessToken).toBeDefined();
      expect(result.data.refreshToken).toBeDefined();
      expect(result.data.expiresIn).toBe(900);

      // Verify JWT contains correct claims
      const decoded = jwt.verify(result.data.accessToken, publicKey, {
        algorithms: ['RS256'],
      }) as jwt.JwtPayload;
      expect(decoded['sub']).toBe('user-001');
      expect(decoded['email']).toBe('john@ke.aris.africa');
      expect(decoded['role']).toBe(UserRole.NATIONAL_ADMIN);
      expect(decoded['tenantId']).toBe('tenant-ke');
      expect(decoded['tenantLevel']).toBe(TenantLevel.MEMBER_STATE);
    });

    it('should store refresh token in Redis with TTL', async () => {
      const hashed = await bcrypt.hash('StrongPass1', 4);
      prisma.user.findUnique.mockResolvedValue(
        userFixture({ passwordHash: hashed }),
      );

      await service.login(loginDto);

      expect(redis.set).toHaveBeenCalledWith(
        expect.stringMatching(/^refresh:user-001:/),
        expect.any(String),
        604800, // 7 days in seconds
      );
    });

    it('should update lastLoginAt on successful login', async () => {
      const hashed = await bcrypt.hash('StrongPass1', 4);
      prisma.user.findUnique.mockResolvedValue(
        userFixture({ passwordHash: hashed }),
      );

      await service.login(loginDto);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-001' },
        data: { lastLoginAt: expect.any(Date) },
      });
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      const hashed = await bcrypt.hash('DifferentPassword1', 4);
      prisma.user.findUnique.mockResolvedValue(
        userFixture({ passwordHash: hashed }),
      );

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if user is inactive', async () => {
      const hashed = await bcrypt.hash('StrongPass1', 4);
      prisma.user.findUnique.mockResolvedValue(
        userFixture({ passwordHash: hashed, isActive: false }),
      );

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should publish authentication Kafka event on success', async () => {
      const hashed = await bcrypt.hash('StrongPass1', 4);
      prisma.user.findUnique.mockResolvedValue(
        userFixture({ passwordHash: hashed }),
      );

      await service.login(loginDto);

      expect(kafka.send).toHaveBeenCalledWith(
        'sys.credential.user.authenticated.v1',
        'user-001',
        expect.objectContaining({ userId: 'user-001' }),
        expect.objectContaining({ sourceService: 'credential-service' }),
      );
    });

    it('should reject login when account is locked', async () => {
      lockout.isLocked.mockResolvedValue(true);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(lockout.isLocked).toHaveBeenCalledWith(loginDto.email);
    });

    it('should record failed attempt on wrong password', async () => {
      const hashed = await bcrypt.hash('DifferentPassword1', 4);
      prisma.user.findUnique.mockResolvedValue(
        userFixture({ passwordHash: hashed }),
      );

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(lockout.recordFailedAttempt).toHaveBeenCalledWith(loginDto.email);
    });

    it('should reset lockout attempts on successful login', async () => {
      const hashed = await bcrypt.hash('StrongPass1', 4);
      prisma.user.findUnique.mockResolvedValue(
        userFixture({ passwordHash: hashed }),
      );

      await service.login(loginDto);

      expect(lockout.resetAttempts).toHaveBeenCalledWith(loginDto.email);
    });

    it('should return mfaRequired when user has MFA enabled but no TOTP code provided', async () => {
      const hashed = await bcrypt.hash('StrongPass1', 4);
      prisma.user.findUnique.mockResolvedValue(
        userFixture({ passwordHash: hashed, mfaEnabled: true, mfaSecret: 'JBSWY3DPEHPK3PXP' }),
      );

      const result = await service.login(loginDto);

      expect(result.data).toMatchObject({
        mfaRequired: true,
        accessToken: '',
        refreshToken: '',
        expiresIn: 0,
      });
    });

    it('should reject login with invalid TOTP code', async () => {
      const hashed = await bcrypt.hash('StrongPass1', 4);
      prisma.user.findUnique.mockResolvedValue(
        userFixture({ passwordHash: hashed, mfaEnabled: true, mfaSecret: 'JBSWY3DPEHPK3PXP' }),
      );

      const dtoWithTotp = { ...loginDto, totpCode: '000000' };
      await expect(service.login(dtoWithTotp)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ── refresh ──

  describe('refresh', () => {
    function makeRefreshToken(userId: string, tokenId: string): string {
      return Buffer.from(`${userId}:${tokenId}`).toString('base64url');
    }

    it('should rotate refresh token and return new tokens', async () => {
      const tokenId = 'abc-token-id';
      const refreshToken = makeRefreshToken('user-001', tokenId);

      redis.get.mockResolvedValue(
        JSON.stringify({
          role: UserRole.NATIONAL_ADMIN,
          tenantId: 'tenant-ke',
          tenantLevel: TenantLevel.MEMBER_STATE,
        }),
      );

      prisma.user.findUnique.mockResolvedValue(userFixture());

      const result = await service.refresh(refreshToken);

      expect(result.data.accessToken).toBeDefined();
      expect(result.data.refreshToken).toBeDefined();
      expect(result.data.expiresIn).toBe(900);

      // Old token should be deleted
      expect(redis.del).toHaveBeenCalledWith(`refresh:user-001:${tokenId}`);

      // New token should be stored
      expect(redis.set).toHaveBeenCalledWith(
        expect.stringMatching(/^refresh:user-001:/),
        expect.any(String),
        604800,
      );
    });

    it('should throw UnauthorizedException for invalid base64 token', async () => {
      await expect(service.refresh('not-valid')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if token not found in Redis', async () => {
      const refreshToken = makeRefreshToken('user-001', 'expired-id');
      redis.get.mockResolvedValue(null);

      await expect(service.refresh(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if user is inactive', async () => {
      const refreshToken = makeRefreshToken('user-001', 'valid-id');
      redis.get.mockResolvedValue(
        JSON.stringify({
          role: UserRole.NATIONAL_ADMIN,
          tenantId: 'tenant-ke',
          tenantLevel: TenantLevel.MEMBER_STATE,
        }),
      );
      prisma.user.findUnique.mockResolvedValue(
        userFixture({ isActive: false }),
      );

      await expect(service.refresh(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if user not found', async () => {
      const refreshToken = makeRefreshToken('user-001', 'valid-id');
      redis.get.mockResolvedValue(
        JSON.stringify({
          role: UserRole.NATIONAL_ADMIN,
          tenantId: 'tenant-ke',
          tenantLevel: TenantLevel.MEMBER_STATE,
        }),
      );
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.refresh(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ── logout ──

  describe('logout', () => {
    it('should delete all refresh tokens for user and return success message', async () => {
      redis.delPattern.mockResolvedValue(3);

      const result = await service.logout('user-001');

      expect(result.data.message).toBe('Logged out successfully');
      expect(redis.delPattern).toHaveBeenCalledWith('refresh:user-001:*');
    });

    it('should succeed even if no tokens exist', async () => {
      redis.delPattern.mockResolvedValue(0);

      const result = await service.logout('user-001');
      expect(result.data.message).toBe('Logged out successfully');
    });

    it('should blacklist access token on logout', async () => {
      redis.delPattern.mockResolvedValue(1);

      // Create a real JWT with known expiry
      const accessToken = jwt.sign(
        { sub: 'user-001', email: 'test@aris.africa' },
        privateKey,
        { algorithm: 'RS256', expiresIn: '15m' },
      );

      await service.logout('user-001', accessToken);

      expect(redis.set).toHaveBeenCalledWith(
        `blacklist:${accessToken}`,
        '1',
        expect.any(Number),
      );
    });

    it('should not fail if access token is missing on logout', async () => {
      redis.delPattern.mockResolvedValue(1);

      const result = await service.logout('user-001');
      expect(result.data.message).toBe('Logged out successfully');
    });
  });
});

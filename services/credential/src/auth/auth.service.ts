import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { KafkaProducerService } from '@aris/kafka-client';
import {
  TOPIC_SYS_CREDENTIAL_USER_CREATED,
  TOPIC_SYS_CREDENTIAL_USER_AUTHENTICATED,
} from '@aris/shared-types';
import type { KafkaHeaders } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { PrismaService } from '../prisma.service';
import { RedisService } from '../redis.service';
import { AccountLockoutService } from './account-lockout.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const SERVICE_NAME = 'credential-service';
const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  mfaRequired?: never;
}

export interface MfaRequiredResponse {
  mfaRequired: true;
  accessToken: '';
  refreshToken: '';
  expiresIn: 0;
}

export interface SafeUser {
  id: string;
  tenantId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  locale: string;
  mfaEnabled: boolean;
  lastLoginAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly privateKey: string;
  private readonly publicKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly kafkaProducer: KafkaProducerService,
    private readonly lockout: AccountLockoutService,
  ) {
    this.privateKey = process.env['JWT_PRIVATE_KEY'] ?? '';
    this.publicKey = process.env['JWT_PUBLIC_KEY'] ?? '';
  }

  async register(
    dto: RegisterDto,
    caller: AuthenticatedUser,
  ): Promise<{ data: SafeUser }> {
    // Check duplicate email
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    // Verify tenant exists
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: dto.tenantId },
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${dto.tenantId} not found`);
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        tenantId: dto.tenantId,
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role,
      },
    });

    // Publish Kafka event
    const safeUser = this.toSafeUser(user);
    await this.publishEvent(
      TOPIC_SYS_CREDENTIAL_USER_CREATED,
      user.id,
      safeUser,
      caller.tenantId,
      caller.userId,
    );

    this.logger.log(`User registered: ${user.email} (${user.id})`);
    return { data: safeUser };
  }

  async login(
    dto: LoginDto,
  ): Promise<{ data: TokenResponse | MfaRequiredResponse }> {
    // Check account lockout
    const locked = await this.lockout.isLocked(dto.email);
    if (locked) {
      throw new UnauthorizedException(
        'Account temporarily locked due to too many failed attempts. Try again later.',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { tenant: { select: { level: true } } },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      await this.lockout.recordFailedAttempt(dto.email);
      throw new UnauthorizedException('Invalid credentials');
    }

    // MFA check: if user has MFA enabled, require TOTP code
    if (user.mfaEnabled && !dto.totpCode) {
      return {
        data: {
          mfaRequired: true,
          accessToken: '',
          refreshToken: '',
          expiresIn: 0,
        },
      };
    }

    if (user.mfaEnabled && dto.totpCode) {
      if (!user.mfaSecret) {
        throw new UnauthorizedException('MFA configuration error');
      }
      const { MfaService } = await import('../mfa/mfa.service');
      const isValid = MfaService.validateCode(
        user.mfaSecret,
        dto.totpCode,
        user.email,
      );
      if (!isValid) {
        throw new UnauthorizedException('Invalid TOTP code');
      }
    }

    // Reset lockout on successful login
    await this.lockout.resetAttempts(dto.email);

    // Generate tokens
    const tokens = this.generateTokens(
      user.id,
      user.email,
      user.role,
      user.tenantId,
      user.tenant.level,
      (user as unknown as { locale?: string }).locale,
    );

    // Store refresh token in Redis
    await this.storeRefreshToken(
      user.id,
      tokens.refreshTokenId,
      user.role,
      user.tenantId,
      user.tenant.level,
    );

    // Update lastLoginAt
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Publish Kafka event
    await this.publishEvent(
      TOPIC_SYS_CREDENTIAL_USER_AUTHENTICATED,
      user.id,
      { userId: user.id, email: user.email, tenantId: user.tenantId },
      user.tenantId,
      user.id,
    );

    this.logger.log(`User authenticated: ${user.email}`);
    return {
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: 900, // 15 minutes in seconds
      },
    };
  }

  async refresh(refreshToken: string): Promise<{ data: TokenResponse }> {
    const decoded = this.decodeRefreshToken(refreshToken);
    if (!decoded) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const { userId, tokenId } = decoded;
    const redisKey = `refresh:${userId}:${tokenId}`;
    const stored = await this.redis.get(redisKey);

    if (!stored) {
      throw new UnauthorizedException('Refresh token expired or revoked');
    }

    const sessionData = JSON.parse(stored) as {
      role: string;
      tenantId: string;
      tenantLevel: string;
    };

    // Delete old refresh token
    await this.redis.del(redisKey);

    // Look up user to verify still active
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: { select: { level: true } } },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User account is disabled');
    }

    // Generate new tokens
    const tokens = this.generateTokens(
      user.id,
      user.email,
      user.role,
      user.tenantId,
      user.tenant.level,
      (user as unknown as { locale?: string }).locale,
    );

    // Store new refresh token
    await this.storeRefreshToken(
      user.id,
      tokens.refreshTokenId,
      sessionData.role,
      sessionData.tenantId,
      sessionData.tenantLevel,
    );

    return {
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: 900,
      },
    };
  }

  async logout(
    userId: string,
    accessToken?: string,
  ): Promise<{ data: { message: string } }> {
    // Blacklist the access token for its remaining TTL
    if (accessToken) {
      try {
        const decoded = jwt.decode(accessToken) as { exp?: number } | null;
        if (decoded?.exp) {
          const remainingSeconds = decoded.exp - Math.floor(Date.now() / 1000);
          if (remainingSeconds > 0) {
            await this.redis.set(
              `blacklist:${accessToken}`,
              '1',
              remainingSeconds,
            );
          }
        }
      } catch {
        // Token decode failure is non-critical during logout
      }
    }

    const deleted = await this.redis.delPattern(`refresh:${userId}:*`);
    this.logger.log(`Logout: cleared ${deleted} refresh tokens for user ${userId}`);
    return { data: { message: 'Logged out successfully' } };
  }

  // ── Private helpers ──

  private generateTokens(
    userId: string,
    email: string,
    role: string,
    tenantId: string,
    tenantLevel: string,
    locale?: string,
  ): { accessToken: string; refreshToken: string; refreshTokenId: string } {
    const accessToken = jwt.sign(
      {
        sub: userId,
        email,
        role,
        tenantId,
        tenantLevel,
        locale: locale ?? 'en',
      },
      this.privateKey,
      {
        algorithm: 'RS256',
        expiresIn: ACCESS_TOKEN_EXPIRY,
      },
    );

    const refreshTokenId = randomUUID();
    const refreshToken = Buffer.from(
      `${userId}:${refreshTokenId}`,
    ).toString('base64url');

    return { accessToken, refreshToken, refreshTokenId };
  }

  private async storeRefreshToken(
    userId: string,
    tokenId: string,
    role: string,
    tenantId: string,
    tenantLevel: string,
  ): Promise<void> {
    const key = `refresh:${userId}:${tokenId}`;
    const value = JSON.stringify({
      role,
      tenantId,
      tenantLevel,
      createdAt: new Date().toISOString(),
    });
    await this.redis.set(key, value, REFRESH_TOKEN_TTL_SECONDS);
  }

  private decodeRefreshToken(
    token: string,
  ): { userId: string; tokenId: string } | null {
    try {
      const decoded = Buffer.from(token, 'base64url').toString('utf-8');
      const separatorIndex = decoded.indexOf(':');
      if (separatorIndex === -1) return null;
      const userId = decoded.substring(0, separatorIndex);
      const tokenId = decoded.substring(separatorIndex + 1);
      if (!userId || !tokenId) return null;
      return { userId, tokenId };
    } catch {
      return null;
    }
  }

  private toSafeUser(user: {
    id: string;
    tenantId: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    locale?: string;
    mfaEnabled: boolean;
    lastLoginAt: Date | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): SafeUser {
    return {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      locale: user.locale ?? 'en',
      mfaEnabled: user.mfaEnabled,
      lastLoginAt: user.lastLoginAt,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private async publishEvent(
    topic: string,
    entityId: string,
    payload: unknown,
    tenantId: string,
    userId: string,
  ): Promise<void> {
    const headers: KafkaHeaders = {
      correlationId: randomUUID(),
      sourceService: SERVICE_NAME,
      tenantId,
      userId,
      schemaVersion: '1',
      timestamp: new Date().toISOString(),
    };
    try {
      await this.kafkaProducer.send(topic, entityId, payload, headers);
    } catch (error) {
      this.logger.error(
        `Failed to publish ${topic}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}

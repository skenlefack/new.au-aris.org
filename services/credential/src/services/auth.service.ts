import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { randomUUID, randomBytes } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type Redis from 'ioredis';
import type { FastifyKafka } from '@aris/kafka-client';
import {
  TOPIC_SYS_CREDENTIAL_USER_CREATED,
  TOPIC_SYS_CREDENTIAL_USER_AUTHENTICATED,
  TOPIC_SYS_CREDENTIAL_PASSWORD_RESET,
} from '@aris/shared-types';
import type { KafkaHeaders } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import type { AccountLockoutService } from './account-lockout.service.js';

const SERVICE_NAME = 'credential-service';
const BCRYPT_ROUNDS = 10;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const PASSWORD_RESET_TTL_SECONDS = 15 * 60; // 15 minutes

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    tenantId: string;
    tenantLevel: string;
  };
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

class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export class AuthService {
  private readonly privateKey: string;
  private readonly publicKey: string;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    private readonly kafka: FastifyKafka,
    private readonly lockout: AccountLockoutService,
  ) {
    let privKey = (process.env['JWT_PRIVATE_KEY'] ?? '').replace(/\\n/g, '\n');
    let pubKey = (process.env['JWT_PUBLIC_KEY'] ?? '').replace(/\\n/g, '\n');
    if (!privKey && process.env['JWT_PRIVATE_KEY_PATH']) {
      try { privKey = require('fs').readFileSync(process.env['JWT_PRIVATE_KEY_PATH'], 'utf8'); } catch {}
    }
    if (!pubKey && process.env['JWT_PUBLIC_KEY_PATH']) {
      try { pubKey = require('fs').readFileSync(process.env['JWT_PUBLIC_KEY_PATH'], 'utf8'); } catch {}
    }
    this.privateKey = privKey;
    this.publicKey = pubKey;
  }

  async register(
    dto: { email: string; password: string; firstName: string; lastName: string; role: string; tenantId: string },
    caller: { userId: string; tenantId: string },
  ): Promise<{ data: SafeUser }> {
    const existing = await (this.prisma as any).user.findUnique({ where: { email: dto.email } });
    if (existing) throw new HttpError(409, 'Email already registered');

    const tenant = await (this.prisma as any).tenant.findUnique({ where: { id: dto.tenantId } });
    if (!tenant) throw new HttpError(404, `Tenant ${dto.tenantId} not found`);

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await (this.prisma as any).user.create({
      data: {
        tenantId: dto.tenantId,
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role,
      },
    });

    const safeUser = this.toSafeUser(user);
    await this.publishEvent(TOPIC_SYS_CREDENTIAL_USER_CREATED, user.id, safeUser, caller.tenantId, caller.userId);
    return { data: safeUser };
  }

  async login(
    dto: { email: string; password: string; totpCode?: string },
  ): Promise<{ data: TokenResponse | MfaRequiredResponse }> {
    const locked = await this.lockout.isLocked(dto.email);
    if (locked) throw new HttpError(401, 'Compte temporairement verrouill\u00e9 suite \u00e0 trop de tentatives. R\u00e9essayez plus tard.');

    const user = await (this.prisma as any).user.findUnique({
      where: { email: dto.email },
      include: { tenant: { select: { level: true } } },
    });

    if (!user || !user.isActive) throw new HttpError(401, 'Adresse e-mail ou mot de passe incorrect');

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      await this.lockout.recordFailedAttempt(dto.email);
      throw new HttpError(401, 'Adresse e-mail ou mot de passe incorrect');
    }

    if (user.mfaEnabled && !dto.totpCode) {
      return {
        data: { mfaRequired: true, accessToken: '' as const, refreshToken: '' as const, expiresIn: 0 as const },
      };
    }

    if (user.mfaEnabled && dto.totpCode) {
      if (!user.mfaSecret) throw new HttpError(401, 'Erreur de configuration MFA. Contactez votre administrateur.');
      const { MfaService } = await import('./mfa.service.js');
      const isValid = MfaService.validateCode(user.mfaSecret, dto.totpCode, user.email);
      if (!isValid) throw new HttpError(401, 'Code de v\u00e9rification invalide');
    }

    await this.lockout.resetAttempts(dto.email);

    const tokens = this.generateTokens(user.id, user.email, user.role, user.tenantId, user.tenant.level, user.locale);
    await this.storeRefreshToken(user.id, tokens.refreshTokenId, user.role, user.tenantId, user.tenant.level);

    await (this.prisma as any).user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await this.publishEvent(TOPIC_SYS_CREDENTIAL_USER_AUTHENTICATED, user.id, { userId: user.id, email: user.email, tenantId: user.tenantId }, user.tenantId, user.id);

    return {
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: 900,
        user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, tenantId: user.tenantId, tenantLevel: user.tenant.level },
      },
    };
  }

  async refresh(refreshToken: string): Promise<{ data: TokenResponse }> {
    const decoded = this.decodeRefreshToken(refreshToken);
    if (!decoded) throw new HttpError(401, 'Session invalide. Veuillez vous reconnecter.');

    const { userId, tokenId } = decoded;
    const redisKey = `refresh:${userId}:${tokenId}`;
    const stored = await this.redis.get(redisKey);
    if (!stored) throw new HttpError(401, 'Session expir\u00e9e. Veuillez vous reconnecter.');

    const sessionData = JSON.parse(stored) as { role: string; tenantId: string; tenantLevel: string };
    await this.redis.del(redisKey);

    const user = await (this.prisma as any).user.findUnique({
      where: { id: userId },
      include: { tenant: { select: { level: true } } },
    });
    if (!user || !user.isActive) throw new HttpError(401, 'Ce compte a \u00e9t\u00e9 d\u00e9sactiv\u00e9. Contactez votre administrateur.');

    const tokens = this.generateTokens(user.id, user.email, user.role, user.tenantId, user.tenant.level, user.locale);
    await this.storeRefreshToken(user.id, tokens.refreshTokenId, sessionData.role, sessionData.tenantId, sessionData.tenantLevel);

    return { data: { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expiresIn: 900 } };
  }

  async logout(userId: string, accessToken?: string): Promise<{ data: { message: string } }> {
    if (accessToken) {
      try {
        const decoded = jwt.decode(accessToken) as { exp?: number } | null;
        if (decoded?.exp) {
          const remaining = decoded.exp - Math.floor(Date.now() / 1000);
          if (remaining > 0) {
            await this.redis.set(`blacklist:${accessToken}`, '1', 'EX', remaining);
          }
        }
      } catch {}
    }

    const keys = await this.redis.keys(`refresh:${userId}:*`);
    if (keys.length > 0) await this.redis.del(...keys);
    return { data: { message: 'Logged out successfully' } };
  }

  async forgotPassword(email: string, baseUrl: string): Promise<{ data: { message: string } }> {
    // Always return success to prevent email enumeration attacks
    const successMsg = { data: { message: 'If an account with that email exists, a password reset link has been sent.' } };

    const user = await (this.prisma as any).user.findUnique({ where: { email } });
    if (!user || !user.isActive) return successMsg;

    const token = randomBytes(32).toString('hex');
    const key = `password-reset:${token}`;
    await this.redis.set(key, user.id, 'EX', PASSWORD_RESET_TTL_SECONDS);

    const resetUrl = `${baseUrl}/reset-password?token=${token}`;

    // Publish password reset event to Kafka for the message service to send the email
    try {
      await this.kafka.send(TOPIC_SYS_CREDENTIAL_PASSWORD_RESET, user.id, {
        userId: user.id,
        email: user.email,
        resetUrl,
        expiresIn: '15 minutes',
      }, {
        correlationId: randomUUID(),
        sourceService: SERVICE_NAME,
        tenantId: user.tenantId,
        userId: user.id,
        schemaVersion: '1',
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[PASSWORD_RESET] Failed to publish Kafka event:', err);
    }

    return successMsg;
  }

  async resetPassword(token: string, newPassword: string): Promise<{ data: { message: string } }> {
    const key = `password-reset:${token}`;
    const userId = await this.redis.get(key);
    if (!userId) throw new HttpError(400, 'Invalid or expired reset token');

    const user = await (this.prisma as any).user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) throw new HttpError(400, 'Invalid or expired reset token');

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await (this.prisma as any).user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Invalidate the token so it can't be reused
    await this.redis.del(key);

    // Invalidate all existing refresh tokens for this user (force re-login)
    const refreshKeys = await this.redis.keys(`refresh:${userId}:*`);
    if (refreshKeys.length > 0) await this.redis.del(...refreshKeys);

    return { data: { message: 'Password has been reset successfully. You can now log in.' } };
  }

  private generateTokens(userId: string, email: string, role: string, tenantId: string, tenantLevel: string, locale?: string) {
    const accessToken = jwt.sign({ sub: userId, email, role, tenantId, tenantLevel, locale: locale ?? 'en' }, this.privateKey, { algorithm: 'RS256', expiresIn: ACCESS_TOKEN_EXPIRY });
    const refreshTokenId = randomUUID();
    const refreshToken = Buffer.from(`${userId}:${refreshTokenId}`).toString('base64url');
    return { accessToken, refreshToken, refreshTokenId };
  }

  private async storeRefreshToken(userId: string, tokenId: string, role: string, tenantId: string, tenantLevel: string): Promise<void> {
    const key = `refresh:${userId}:${tokenId}`;
    const value = JSON.stringify({ role, tenantId, tenantLevel, createdAt: new Date().toISOString() });
    await this.redis.set(key, value, 'EX', REFRESH_TOKEN_TTL_SECONDS);
  }

  private decodeRefreshToken(token: string): { userId: string; tokenId: string } | null {
    try {
      const decoded = Buffer.from(token, 'base64url').toString('utf-8');
      const idx = decoded.indexOf(':');
      if (idx === -1) return null;
      const userId = decoded.substring(0, idx);
      const tokenId = decoded.substring(idx + 1);
      if (!userId || !tokenId) return null;
      return { userId, tokenId };
    } catch { return null; }
  }

  private toSafeUser(user: any): SafeUser {
    return {
      id: user.id, tenantId: user.tenantId, email: user.email,
      firstName: user.firstName, lastName: user.lastName, role: user.role,
      locale: user.locale ?? 'en', mfaEnabled: user.mfaEnabled,
      lastLoginAt: user.lastLoginAt, isActive: user.isActive,
      createdAt: user.createdAt, updatedAt: user.updatedAt,
    };
  }

  private async publishEvent(topic: string, entityId: string, payload: unknown, tenantId: string, userId: string): Promise<void> {
    const headers: KafkaHeaders = {
      correlationId: randomUUID(), sourceService: SERVICE_NAME, tenantId, userId,
      schemaVersion: '1', timestamp: new Date().toISOString(),
    };
    try { await this.kafka.send(topic, entityId, payload, headers); } catch {}
  }
}

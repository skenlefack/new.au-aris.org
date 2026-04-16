import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { randomUUID, randomBytes, createHash } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type Redis from 'ioredis';
import type { FastifyKafka } from '@aris/kafka-client';
import {
  TOPIC_SYS_CREDENTIAL_USER_CREATED,
  TOPIC_SYS_CREDENTIAL_USER_AUTHENTICATED,
  TOPIC_SYS_CREDENTIAL_PASSWORD_RESET,
  TOPIC_SYS_CREDENTIAL_NEW_DEVICE_LOGIN,
} from '@aris/shared-types';
import type { KafkaHeaders } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import type { AccountLockoutService } from './account-lockout.service.js';
import type { DomainService } from './domain.service.js';

const SERVICE_NAME = 'credential-service';
const BCRYPT_ROUNDS = 10;

// ── Device detection helpers ──────────────────────────────────────────────────

function parseDeviceInfo(userAgent: string): { deviceName: string; deviceType: 'web' | 'mobile' } {
  const ua = userAgent.toLowerCase();
  const isMobile = /android|mobile|iphone|ipad|ipod|blackberry|opera mini|windows phone/i.test(ua);
  const deviceType: 'web' | 'mobile' = isMobile ? 'mobile' : 'web';

  let browser = 'Unknown Browser';
  if (ua.includes('edg/') || ua.includes('edge/')) browser = 'Edge';
  else if (ua.includes('firefox/')) browser = 'Firefox';
  else if (ua.includes('opr/') || ua.includes('opera/')) browser = 'Opera';
  else if (ua.includes('chrome/')) browser = 'Chrome';
  else if (ua.includes('safari/')) browser = 'Safari';
  else if (!ua) browser = 'Mobile App';

  let os = 'Unknown OS';
  if (ua.includes('windows nt 10') || ua.includes('windows nt 11')) os = 'Windows 10/11';
  else if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('mac os x') || ua.includes('macos')) os = 'macOS';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('iphone')) os = 'iPhone';
  else if (ua.includes('ipad')) os = 'iPad';
  else if (ua.includes('linux')) os = 'Linux';

  const deviceName = isMobile ? `${browser} on ${os} (mobile)` : `${browser} on ${os}`;
  return { deviceName, deviceType };
}

/** Compute a short fingerprint from the User-Agent string (SHA-256, first 32 hex chars). */
function computeFingerprint(userAgent: string): string {
  const input = userAgent || 'unknown';
  return createHash('sha256').update(input).digest('hex').substring(0, 32);
}

// ─────────────────────────────────────────────────────────────────────────────
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
    roles: string[];
    tenantId: string;
    tenantLevel: string;
    domains: Array<{ id: string; code: string; name: Record<string, string>; icon: string; color: string }>;
    mustChangePassword: boolean;
  };
  permissions?: Array<{ module: string; feature: string; action: string }>;
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
  mustChangePassword: boolean;
  passwordChangedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

class HttpError extends Error {
  constructor(public statusCode: number, message: string, public code?: string) {
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
    private readonly domainService?: DomainService,
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
    dto: { email: string; password: string; firstName: string; lastName: string; phone?: string; role: string; tenantId: string; domainIds?: string[] },
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
        phone: dto.phone || null,
        role: dto.role,
        // Admin-created users receive a temporary password and must change it
        // on their first login. The ForcePasswordChangeModal on the frontend
        // blocks all navigation until this flag is cleared.
        mustChangePassword: true,
      },
    });

    // Assign domains if provided
    if (dto.domainIds?.length && this.domainService) {
      await this.domainService.setUserDomains(user.id, dto.domainIds, caller.userId, caller.tenantId);
    }

    const safeUser = this.toSafeUser(user);

    // Enriched payload for the welcome email consumer in the message service.
    // Includes the plain-text temporary password (only ever transmitted here,
    // inside a one-off Kafka event that is consumed by the email worker) so
    // the user can perform their very first login. The password is never
    // persisted outside of the user record's bcrypt hash, and the user is
    // forced to change it immediately by the ForcePasswordChangeModal.
    const publicBase = process.env['PUBLIC_WEB_URL'] ?? 'https://au-aris.org';
    const eventPayload = {
      ...safeUser,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      tenantName: tenant.name ?? tenant.code ?? null,
      temporaryPassword: dto.password,
      loginUrl: `${publicBase}/login`,
    };
    // Fire-and-forget — don't block the response on Kafka availability
    this.publishEvent(TOPIC_SYS_CREDENTIAL_USER_CREATED, user.id, eventPayload, caller.tenantId, caller.userId);
    return { data: safeUser };
  }

  async login(
    dto: { email: string; password: string; totpCode?: string },
    context?: { ipAddress?: string; userAgent?: string },
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

    // ── Device & session management ──────────────────────────────────
    const ipAddress = context?.ipAddress ?? 'unknown';
    const userAgent = context?.userAgent ?? '';
    const { deviceName, deviceType } = parseDeviceInfo(userAgent);
    const fingerprint = computeFingerprint(userAgent);

    // Read security settings (non-blocking — fallback to safe defaults)
    const allowMultipleConnections = await this.getSecuritySetting('security.session.allowMultipleConnections') as boolean ?? false;
    const loginNotificationEmail = await this.getSecuritySetting('security.session.loginNotificationEmail') as boolean ?? true;

    // Track device: upsert UserDevice record + detect if first-time device
    let isNewDevice = false;
    try {
      const existingDevice = await (this.prisma as any).userDevice.findUnique({
        where: { userId_fingerprint: { userId: user.id, fingerprint } },
      });
      isNewDevice = !existingDevice;
      await (this.prisma as any).userDevice.upsert({
        where: { userId_fingerprint: { userId: user.id, fingerprint } },
        update: { lastIp: ipAddress, deviceName },
        create: { userId: user.id, fingerprint, deviceName, deviceType, lastIp: ipAddress },
      });
    } catch { /* UserDevice table may not exist yet — skip silently */ }

    // Enforce 1 web + 1 mobile limit when allowMultipleConnections=false
    if (!allowMultipleConnections) {
      await this.revokeSessionsByDeviceType(user.id, deviceType);
    }
    // ─────────────────────────────────────────────────────────────────

    // Fetch user's domain codes for JWT + full objects for frontend
    const domainCodes = this.domainService ? await this.domainService.getUserDomainCodes(user.id) : [];
    const userDomainsResult = this.domainService ? await this.domainService.getUserDomains(user.id) : { data: [] };

    // Compute effective roles from UserRoleAssignment table
    const effectiveRoles = await this.computeEffectiveRoles(user.id, user.role);
    // Compute permissions for frontend
    const permissions = await this.computePermissions(effectiveRoles);

    const tokens = this.generateTokens(user.id, user.email, user.role, user.tenantId, user.tenant.level, user.locale, domainCodes, effectiveRoles);
    await this.storeRefreshToken(user.id, tokens.refreshTokenId, user.role, user.tenantId, user.tenant.level, deviceType);

    await (this.prisma as any).user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    // Fire-and-forget — never block the login response on Kafka availability
    this.publishEvent(TOPIC_SYS_CREDENTIAL_USER_AUTHENTICATED, user.id, { userId: user.id, email: user.email, tenantId: user.tenantId }, user.tenantId, user.id);

    // Cache permissions in Redis (TTL 15 min)
    await this.cachePermissions(user.id, effectiveRoles, permissions);

    // Send login notification email:
    //   • always for a new/unrecognised device
    //   • always when allowMultipleConnections=true (every login is a potential security event)
    if (loginNotificationEmail && (isNewDevice || allowMultipleConnections)) {
      // Fire-and-forget — never block the login response on Kafka availability
      this.publishEvent(TOPIC_SYS_CREDENTIAL_NEW_DEVICE_LOGIN, user.id, {
        userId: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        deviceName,
        deviceType,
        fingerprint,
        ipAddress,
        loginAt: new Date().toISOString(),
        isNewDevice,
        allowMultipleConnections,
        tenantId: user.tenantId,
      }, user.tenantId, user.id);
    }

    return {
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: 900,
        user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, roles: effectiveRoles, tenantId: user.tenantId, tenantLevel: user.tenant.level, domains: userDomainsResult.data, mustChangePassword: user.mustChangePassword ?? false },
        permissions,
      },
    };
  }

  async refresh(refreshToken: string): Promise<{ data: TokenResponse }> {
    const decoded = this.decodeRefreshToken(refreshToken);
    if (!decoded) throw new HttpError(401, 'Session invalide. Veuillez vous reconnecter.');

    const { userId, tokenId } = decoded;
    const redisKey = `refresh:${userId}:${tokenId}`;
    const stored = await this.redis.get(redisKey);
    if (!stored) throw new HttpError(401, 'Session expir\u00e9e. Veuillez vous reconnecter.', 'SESSION_EXPIRED');

    const sessionData = JSON.parse(stored) as { role: string; tenantId: string; tenantLevel: string; revoked?: boolean; revokedReason?: string };
    if (sessionData.revoked) {
      await this.redis.del(redisKey);
      throw new HttpError(401, 'Votre session a \u00e9t\u00e9 ferm\u00e9e car une nouvelle connexion a \u00e9t\u00e9 ouverte depuis un autre appareil.', sessionData.revokedReason ?? 'SESSION_REVOKED_NEW_DEVICE');
    }
    await this.redis.del(redisKey);

    const user = await (this.prisma as any).user.findUnique({
      where: { id: userId },
      include: { tenant: { select: { level: true } } },
    });
    if (!user || !user.isActive) throw new HttpError(401, 'Ce compte a \u00e9t\u00e9 d\u00e9sactiv\u00e9. Contactez votre administrateur.');

    // Fetch fresh domain codes for the new JWT
    const domainCodes = this.domainService ? await this.domainService.getUserDomainCodes(user.id) : [];

    // Refresh effective roles
    const effectiveRoles = await this.computeEffectiveRoles(user.id, user.role);

    const tokens = this.generateTokens(user.id, user.email, user.role, user.tenantId, user.tenant.level, user.locale, domainCodes, effectiveRoles);
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

  private generateTokens(userId: string, email: string, role: string, tenantId: string, tenantLevel: string, locale?: string, domains?: string[], roles?: string[]) {
    const effectiveRoles = roles ?? [role];
    const accessToken = jwt.sign({ sub: userId, email, role, roles: effectiveRoles, tenantId, tenantLevel, locale: locale ?? 'en', domains: domains ?? [] }, this.privateKey, { algorithm: 'RS256', expiresIn: ACCESS_TOKEN_EXPIRY });
    const refreshTokenId = randomUUID();
    const refreshToken = Buffer.from(`${userId}:${refreshTokenId}`).toString('base64url');
    return { accessToken, refreshToken, refreshTokenId };
  }

  private async storeRefreshToken(
    userId: string, tokenId: string, role: string, tenantId: string, tenantLevel: string,
    deviceType?: string,
  ): Promise<void> {
    const key = `refresh:${userId}:${tokenId}`;
    const value = JSON.stringify({ role, tenantId, tenantLevel, createdAt: new Date().toISOString(), deviceType: deviceType ?? 'web' });
    await this.redis.set(key, value, 'EX', REFRESH_TOKEN_TTL_SECONDS);
  }

  /** Revoke all active refresh tokens of a given device type (web/mobile) for a user. */
  private async revokeSessionsByDeviceType(userId: string, deviceType: string): Promise<void> {
    try {
      const keys = await this.redis.keys(`refresh:${userId}:*`);
      for (const key of keys) {
        const stored = await this.redis.get(key);
        if (!stored) continue;
        try {
          const data = JSON.parse(stored) as { deviceType?: string };
          const storedType = data.deviceType ?? 'web';
          if (storedType === deviceType) {
            // Mark as revoked with short TTL (5 min) so the device can show a descriptive error
            const revokedData = { ...data, revoked: true, revokedReason: 'SESSION_REVOKED_NEW_DEVICE' };
            await this.redis.set(key, JSON.stringify(revokedData), 'EX', 300);
          }
        } catch { /* malformed — skip */ }
      }
    } catch { /* best-effort */ }
  }

  /** Read a security setting from the governance.system_configs table. */
  private async getSecuritySetting(key: string): Promise<unknown> {
    try {
      const config = await (this.prisma as any).systemConfig.findUnique({
        where: { category_key: { category: 'security', key } },
      });
      return config?.value ?? null;
    } catch { return null; }
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
      mustChangePassword: user.mustChangePassword ?? false,
      passwordChangedAt: user.passwordChangedAt ?? null,
      createdAt: user.createdAt, updatedAt: user.updatedAt,
    };
  }

  // ─── Permission resolution ─────────────────────────────────────────

  /**
   * Compute effective role codes for a user:
   * 1. The user's primary `role` field (UserRole enum)
   * 2. Direct UserRoleAssignment records (source="direct")
   * 3. Function-derived UserRoleAssignment records (source="function")
   * Returns a deduplicated array of role codes.
   */
  private async computeEffectiveRoles(userId: string, primaryRole: string): Promise<string[]> {
    try {
      const assignments = await (this.prisma as any).userRoleAssignment.findMany({
        where: { userId },
        include: { role: { select: { code: true, isActive: true } } },
      });
      const roleCodes = new Set<string>([primaryRole]);
      for (const a of assignments) {
        if (a.role?.isActive) roleCodes.add(a.role.code);
      }
      return Array.from(roleCodes);
    } catch {
      // Table may not exist yet (migration not run) — fallback to primary role
      return [primaryRole];
    }
  }

  /**
   * Compute permissions from effective roles via RolePermission → Permission join.
   */
  private async computePermissions(effectiveRoles: string[]): Promise<Array<{ module: string; feature: string; action: string }>> {
    try {
      const rolePermissions = await (this.prisma as any).rolePermission.findMany({
        where: {
          role: { code: { in: effectiveRoles }, isActive: true },
        },
        include: {
          permission: { select: { module: true, feature: true, action: true, isActive: true } },
        },
      });

      const permSet = new Set<string>();
      const result: Array<{ module: string; feature: string; action: string }> = [];

      for (const rp of rolePermissions) {
        if (!rp.permission?.isActive) continue;
        const key = `${rp.permission.module}:${rp.permission.feature}:${rp.permission.action}`;
        if (!permSet.has(key)) {
          permSet.add(key);
          result.push({
            module: rp.permission.module,
            feature: rp.permission.feature,
            action: rp.permission.action,
          });
        }
      }

      return result;
    } catch {
      // Table may not exist yet — return empty
      return [];
    }
  }

  /**
   * Cache user permissions in Redis with TTL 15 minutes.
   */
  private async cachePermissions(
    userId: string,
    roles: string[],
    permissions: Array<{ module: string; feature: string; action: string }>,
  ): Promise<void> {
    try {
      const key = `aris:permissions:${userId}`;
      const value = JSON.stringify({ roles, permissions });
      await this.redis.set(key, value, 'EX', 900); // 15 min
    } catch {}
  }

  private async publishEvent(topic: string, entityId: string, payload: unknown, tenantId: string, userId: string): Promise<void> {
    const headers: KafkaHeaders = {
      correlationId: randomUUID(), sourceService: SERVICE_NAME, tenantId, userId,
      schemaVersion: '1', timestamp: new Date().toISOString(),
    };
    try { await this.kafka.send(topic, entityId, payload, headers); } catch {}
  }
}

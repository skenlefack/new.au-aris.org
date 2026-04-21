import type { PrismaClient } from '@prisma/client';
import type Redis from 'ioredis';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import type { GeolocationService } from './geolocation.service.js';

const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export interface RecordLoginParams {
  userId: string;
  tenantId: string;
  refreshTokenId: string;
  deviceName: string;
  deviceType: string;
  fingerprint: string;
  userAgent: string;
  ipAddress: string;
}

export interface SessionQueryParams {
  page?: number;
  limit?: number;
  status?: string;
  deviceType?: string;
  country?: string;
  userId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export class SessionService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    private readonly geo: GeolocationService,
  ) {}

  // ── Write ──────────────────────────────────────────────────

  async recordLogin(params: RecordLoginParams): Promise<void> {
    try {
      const geo = await this.geo.lookup(params.ipAddress);
      await (this.prisma as any).sessionLog.create({
        data: {
          userId: params.userId,
          tenantId: params.tenantId,
          refreshTokenId: params.refreshTokenId,
          status: 'ACTIVE',
          deviceName: params.deviceName,
          deviceType: params.deviceType,
          fingerprint: params.fingerprint,
          userAgent: params.userAgent,
          ipAddress: params.ipAddress,
          country: geo?.country ?? null,
          countryCode: geo?.countryCode ?? null,
          city: geo?.city ?? null,
          latitude: geo?.latitude ?? null,
          longitude: geo?.longitude ?? null,
          expiresAt: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000),
        },
      });
    } catch { /* non-blocking */ }
  }

  async recordLogout(userId: string, refreshTokenId?: string): Promise<void> {
    try {
      const now = new Date();
      if (refreshTokenId) {
        await (this.prisma as any).sessionLog.updateMany({
          where: { userId, refreshTokenId, status: 'ACTIVE' },
          data: { status: 'LOGGED_OUT', logoutAt: now },
        });
      } else {
        await (this.prisma as any).sessionLog.updateMany({
          where: { userId, status: 'ACTIVE' },
          data: { status: 'LOGGED_OUT', logoutAt: now },
        });
      }
    } catch { /* non-blocking */ }
  }

  async recordRevocation(userId: string, deviceType: string): Promise<void> {
    try {
      await (this.prisma as any).sessionLog.updateMany({
        where: { userId, deviceType, status: 'ACTIVE' },
        data: { status: 'REVOKED', logoutAt: new Date() },
      });
    } catch { /* non-blocking */ }
  }

  async touchActivity(userId: string, refreshTokenId: string): Promise<void> {
    try {
      // Debounce: only update if last touch was > 5 min ago
      const key = `session-touch:${refreshTokenId}`;
      const recent = await this.redis.get(key);
      if (recent) return;
      await this.redis.set(key, '1', 'EX', 300);
      await (this.prisma as any).sessionLog.updateMany({
        where: { refreshTokenId, status: 'ACTIVE' },
        data: { lastActivityAt: new Date() },
      });
    } catch { /* non-blocking */ }
  }

  async expireStale(): Promise<number> {
    try {
      const result = await (this.prisma as any).sessionLog.updateMany({
        where: { status: 'ACTIVE', expiresAt: { lt: new Date() } },
        data: { status: 'EXPIRED' },
      });
      return result.count;
    } catch {
      return 0;
    }
  }

  async revokeById(sessionId: string): Promise<boolean> {
    try {
      const session = await (this.prisma as any).sessionLog.findUnique({ where: { id: sessionId } });
      if (!session || session.status !== 'ACTIVE') return false;
      await (this.prisma as any).sessionLog.update({
        where: { id: sessionId },
        data: { status: 'REVOKED', logoutAt: new Date() },
      });
      // Also delete the refresh token from Redis
      const keys = await this.redis.keys(`refresh:${session.userId}:${session.refreshTokenId}`);
      if (keys.length > 0) await this.redis.del(...keys);
      return true;
    } catch {
      return false;
    }
  }

  // ── Read ───────────────────────────────────────────────────

  async query(caller: AuthenticatedUser, params: SessionQueryParams) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (caller.role !== 'SUPER_ADMIN') {
      where.tenantId = caller.tenantId;
    }
    if (params.status) where.status = params.status;
    if (params.deviceType) where.deviceType = params.deviceType;
    if (params.country) where.countryCode = params.country;
    if (params.userId) where.userId = params.userId;

    if (params.dateFrom || params.dateTo) {
      where.loginAt = {};
      if (params.dateFrom) (where.loginAt as any).gte = new Date(params.dateFrom);
      if (params.dateTo) (where.loginAt as any).lte = new Date(params.dateTo);
    }

    if (params.search) {
      where.OR = [
        { deviceName: { contains: params.search, mode: 'insensitive' } },
        { ipAddress: { contains: params.search, mode: 'insensitive' } },
        { country: { contains: params.search, mode: 'insensitive' } },
        { city: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const p = this.prisma as any;
    const [entries, total] = await Promise.all([
      p.sessionLog.findMany({
        where,
        orderBy: { loginAt: 'desc' },
        skip,
        take: limit,
      }),
      p.sessionLog.count({ where }),
    ]);

    // Resolve user emails
    const userIds = [...new Set(entries.map((e: any) => e.userId))];
    let userMap: Record<string, { email: string; firstName: string; lastName: string }> = {};
    if (userIds.length > 0) {
      const users = await p.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, email: true, firstName: true, lastName: true },
      });
      userMap = Object.fromEntries(users.map((u: any) => [u.id, { email: u.email, firstName: u.firstName, lastName: u.lastName }]));
    }

    const data = entries.map((e: any) => {
      const user = userMap[e.userId] ?? { email: 'unknown', firstName: '', lastName: '' };
      const logoutOrNow = e.logoutAt ?? (e.status === 'ACTIVE' ? new Date() : e.lastActivityAt);
      const durationMin = logoutOrNow ? Math.round((new Date(logoutOrNow).getTime() - new Date(e.loginAt).getTime()) / 60000) : null;
      return {
        id: e.id,
        user: { userId: e.userId, email: user.email, firstName: user.firstName, lastName: user.lastName },
        status: e.status,
        deviceName: e.deviceName,
        deviceType: e.deviceType,
        ipAddress: e.ipAddress,
        country: e.country,
        countryCode: e.countryCode,
        city: e.city,
        latitude: e.latitude,
        longitude: e.longitude,
        loginAt: e.loginAt.toISOString(),
        lastActivityAt: e.lastActivityAt.toISOString(),
        logoutAt: e.logoutAt?.toISOString() ?? null,
        expiresAt: e.expiresAt.toISOString(),
        duration: durationMin,
      };
    });

    return { data, meta: { total, page, limit } };
  }

  async getStats(caller: AuthenticatedUser, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const tenantFilter: Record<string, unknown> = { loginAt: { gte: since } };
    if (caller.role !== 'SUPER_ADMIN') {
      tenantFilter.tenantId = caller.tenantId;
    }

    const p = this.prisma as any;

    const [allSessions, activeSessions] = await Promise.all([
      p.sessionLog.findMany({ where: tenantFilter, select: { loginAt: true, logoutAt: true, lastActivityAt: true, status: true, country: true, countryCode: true, deviceType: true, userId: true } }),
      p.sessionLog.count({ where: { ...tenantFilter, status: 'ACTIVE', expiresAt: { gt: new Date() } } }),
    ]);

    // Aggregate in JS (simpler than raw SQL, fine for reasonable dataset sizes)
    const totalSessions = allSessions.length;
    const uniqueCountries = new Set(allSessions.map((s: any) => s.countryCode).filter(Boolean)).size;
    const uniqueUsers = new Set(allSessions.map((s: any) => s.userId)).size;

    // Avg duration
    let totalDuration = 0;
    let durationCount = 0;
    for (const s of allSessions) {
      const end = s.logoutAt ?? (s.status === 'ACTIVE' ? new Date() : s.lastActivityAt);
      if (end) {
        totalDuration += new Date(end).getTime() - new Date(s.loginAt).getTime();
        durationCount++;
      }
    }
    const avgDurationMinutes = durationCount > 0 ? Math.round(totalDuration / durationCount / 60000) : 0;

    // Logins by day
    const byDay: Record<string, number> = {};
    for (const s of allSessions) {
      const day = new Date(s.loginAt).toISOString().substring(0, 10);
      byDay[day] = (byDay[day] ?? 0) + 1;
    }
    const loginsByDay = Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }));

    // By country
    const byCountry: Record<string, { country: string; countryCode: string; count: number }> = {};
    for (const s of allSessions) {
      const cc = s.countryCode ?? 'XX';
      if (!byCountry[cc]) byCountry[cc] = { country: s.country ?? 'Unknown', countryCode: cc, count: 0 };
      byCountry[cc].count++;
    }
    const loginsByCountry = Object.values(byCountry).sort((a, b) => b.count - a.count);

    // By device type
    const byDevice: Record<string, number> = {};
    for (const s of allSessions) {
      byDevice[s.deviceType] = (byDevice[s.deviceType] ?? 0) + 1;
    }
    const loginsByDeviceType = Object.entries(byDevice).map(([deviceType, count]) => ({ deviceType, count }));

    // By hour (0-23)
    const byHour = Array.from({ length: 24 }, () => 0);
    for (const s of allSessions) {
      const h = new Date(s.loginAt).getUTCHours();
      byHour[h]++;
    }
    const loginsByHour = byHour.map((count, hour) => ({ hour, count }));
    const peakHour = byHour.indexOf(Math.max(...byHour));

    // Top users
    const byUser: Record<string, number> = {};
    for (const s of allSessions) {
      byUser[s.userId] = (byUser[s.userId] ?? 0) + 1;
    }
    const topUserIds = Object.entries(byUser).sort(([, a], [, b]) => b - a).slice(0, 10);
    const topUserMap: Record<string, string> = {};
    if (topUserIds.length > 0) {
      const ids = topUserIds.map(([id]) => id);
      const users = await p.user.findMany({ where: { id: { in: ids } }, select: { id: true, email: true } });
      for (const u of users) topUserMap[u.id] = u.email;
    }
    const topUsers = topUserIds.map(([userId, count]) => ({ userId, email: topUserMap[userId] ?? 'unknown', count }));

    return {
      data: {
        totalSessions,
        activeSessions,
        uniqueCountries,
        uniqueUsers,
        avgDurationMinutes,
        peakHour,
        loginsByDay,
        loginsByCountry,
        loginsByDeviceType,
        loginsByHour,
        topUsers,
      },
    };
  }
}

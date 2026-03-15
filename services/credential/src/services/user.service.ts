import type { PrismaClient } from '@prisma/client';
import type Redis from 'ioredis';
import { TenantLevel, UserRole, DEFAULT_PAGE, DEFAULT_LIMIT, MAX_LIMIT } from '@aris/shared-types';
import type { PaginationQuery, PaginatedResponse, ApiResponse } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

const USER_SELECT = {
  id: true, tenantId: true, email: true, firstName: true, lastName: true,
  role: true, locale: true, mfaEnabled: true, lastLoginAt: true,
  isActive: true, createdAt: true, updatedAt: true,
} as const;

const CACHE_TTL_USER_PROFILE = 1800; // 30 minutes — aligned with JWT refresh cycle

class HttpError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}

export class UserService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis?: Redis,
  ) {}

  async findAll(caller: AuthenticatedUser, query: PaginationQuery): Promise<PaginatedResponse<any>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;
    const orderBy = query.sort ? { [query.sort]: query.order ?? 'asc' } : { createdAt: 'asc' as const };
    const where = this.buildTenantFilter(caller);

    const [data, total] = await Promise.all([
      (this.prisma as any).user.findMany({ where, select: USER_SELECT, skip, take: limit, orderBy }),
      (this.prisma as any).user.count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  async findMe(caller: AuthenticatedUser): Promise<ApiResponse<any>> {
    // Cache user profile — hot path called on every page load
    if (this.redis) {
      const cacheKey = `aris:credential:user:${caller.userId}`;
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) return JSON.parse(cached);
      } catch { /* cache miss — fall through to DB */ }

      const user = await (this.prisma as any).user.findUnique({ where: { id: caller.userId }, select: USER_SELECT });
      if (!user) throw new HttpError(404, 'User not found');
      const result = { data: user };

      try {
        await this.redis.set(cacheKey, JSON.stringify(result), 'EX', CACHE_TTL_USER_PROFILE);
      } catch { /* cache write failure is non-blocking */ }
      return result;
    }

    const user = await (this.prisma as any).user.findUnique({ where: { id: caller.userId }, select: USER_SELECT });
    if (!user) throw new HttpError(404, 'User not found');
    return { data: user };
  }

  async update(id: string, dto: Record<string, unknown>, caller: AuthenticatedUser): Promise<ApiResponse<any>> {
    const existing = await (this.prisma as any).user.findUnique({ where: { id }, select: { ...USER_SELECT, tenantId: true } });
    if (!existing) throw new HttpError(404, `User ${id} not found`);
    this.verifyTenantAccess(caller, existing.tenantId);

    if (dto.role !== undefined && dto.role !== existing.role) {
      if (caller.role !== UserRole.SUPER_ADMIN) throw new HttpError(403, 'Only SUPER_ADMIN can change user roles');
    }

    const updateData: Record<string, unknown> = {};
    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.firstName !== undefined) updateData.firstName = dto.firstName;
    if (dto.lastName !== undefined) updateData.lastName = dto.lastName;
    if (dto.role !== undefined) updateData.role = dto.role;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.locale !== undefined) updateData.locale = dto.locale;

    const user = await (this.prisma as any).user.update({ where: { id }, data: updateData, select: USER_SELECT });
    // Invalidate cached profile
    if (this.redis) {
      try { await this.redis.del(`aris:credential:user:${id}`); } catch { /* non-blocking */ }
    }
    return { data: user };
  }

  async updateLocale(userId: string, locale: string): Promise<ApiResponse<any>> {
    const user = await (this.prisma as any).user.findUnique({ where: { id: userId } });
    if (!user) throw new HttpError(404, `User ${userId} not found`);
    const updated = await (this.prisma as any).user.update({ where: { id: userId }, data: { locale }, select: USER_SELECT });
    if (this.redis) {
      try { await this.redis.del(`aris:credential:user:${userId}`); } catch { /* non-blocking */ }
    }
    return { data: updated };
  }

  private buildTenantFilter(caller: AuthenticatedUser): Record<string, unknown> {
    switch (caller.tenantLevel) {
      case TenantLevel.CONTINENTAL: return {};
      case TenantLevel.REC: return { tenant: { OR: [{ id: caller.tenantId }, { parentId: caller.tenantId }] } };
      case TenantLevel.MEMBER_STATE: return { tenantId: caller.tenantId };
      default: return { tenantId: caller.tenantId };
    }
  }

  private verifyTenantAccess(caller: AuthenticatedUser, targetTenantId: string): void {
    if (caller.tenantLevel === TenantLevel.CONTINENTAL) return;
    if (caller.tenantId === targetTenantId) return;
    if (caller.tenantLevel === TenantLevel.REC) return;
    throw new HttpError(403, 'Cannot modify users in another tenant');
  }
}

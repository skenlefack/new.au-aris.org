import * as bcrypt from 'bcrypt';
import type { PrismaClient } from '@prisma/client';
import type Redis from 'ioredis';
import { TenantLevel, UserRole, DEFAULT_PAGE, DEFAULT_LIMIT, MAX_LIMIT } from '@aris/shared-types';
import type { PaginationQuery, PaginatedResponse, ApiResponse } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import type { DomainService } from './domain.service.js';

const USER_SELECT = {
  id: true, tenantId: true, email: true, firstName: true, lastName: true,
  phone: true, role: true, locale: true, mfaEnabled: true, avatarUrl: true, lastLoginAt: true,
  isActive: true, mustChangePassword: true, passwordChangedAt: true, createdAt: true, updatedAt: true,
  userDomains: {
    where: { isActive: true },
    include: { domain: { select: { id: true, code: true, name: true, icon: true, color: true } } },
    orderBy: { domain: { sortOrder: 'asc' as const } },
  },
} as const;

const CACHE_TTL_USER_PROFILE = 1800; // 30 minutes — aligned with JWT refresh cycle

class HttpError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}

export class UserService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis?: Redis,
    private readonly domainService?: DomainService,
  ) {}

  /** Transform raw user record (with userDomains) into API response shape */
  private transformUser(user: any): any {
    if (!user) return user;
    const { userDomains, ...rest } = user;
    return {
      ...rest,
      domains: userDomains?.map((ud: any) => ud.domain) ?? [],
    };
  }

  async findAll(caller: AuthenticatedUser, query: PaginationQuery & { search?: string; role?: string; status?: string }): Promise<PaginatedResponse<any>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;
    const orderBy = query.sort ? { [query.sort]: query.order ?? 'asc' } : { createdAt: 'asc' as const };
    const where: Record<string, unknown> = { ...this.buildTenantFilter(caller) };

    // Search by name or email
    if (query.search) {
      const q = query.search;
      (where as any).OR = [
        { email: { contains: q, mode: 'insensitive' } },
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
      ];
    }

    // Filter by role
    if (query.role) {
      where.role = query.role;
    }

    // Filter by status
    if (query.status === 'active') {
      where.isActive = true;
    } else if (query.status === 'inactive') {
      where.isActive = false;
    }

    const [rawData, total] = await Promise.all([
      (this.prisma as any).user.findMany({ where, select: { ...USER_SELECT, tenant: { select: { id: true, name: true, level: true, countryCode: true } } }, skip, take: limit, orderBy }),
      (this.prisma as any).user.count({ where }),
    ]);

    return { data: rawData.map((u: any) => this.transformUser(u)), meta: { total, page, limit } };
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
      const result = { data: this.transformUser(user) };

      try {
        await this.redis.set(cacheKey, JSON.stringify(result), 'EX', CACHE_TTL_USER_PROFILE);
      } catch { /* cache write failure is non-blocking */ }
      return result;
    }

    const user = await (this.prisma as any).user.findUnique({ where: { id: caller.userId }, select: USER_SELECT });
    if (!user) throw new HttpError(404, 'User not found');
    return { data: this.transformUser(user) };
  }

  async getMyPermissions(caller: AuthenticatedUser): Promise<ApiResponse<any>> {
    // Try Redis cache first
    if (this.redis) {
      try {
        const cached = await this.redis.get(`aris:permissions:${caller.userId}`);
        if (cached) return { data: JSON.parse(cached) };
      } catch {}
    }

    // Compute from DB
    try {
      // Get effective roles
      const assignments = await (this.prisma as any).userRoleAssignment.findMany({
        where: { userId: caller.userId },
        include: { role: { select: { code: true, isActive: true } } },
      });
      const roleCodes = new Set<string>([caller.role]);
      for (const a of assignments) {
        if (a.role?.isActive) roleCodes.add(a.role.code);
      }
      const roles = Array.from(roleCodes);

      // Get permissions
      const rolePermissions = await (this.prisma as any).rolePermission.findMany({
        where: { role: { code: { in: roles }, isActive: true } },
        include: { permission: { select: { module: true, feature: true, action: true, isActive: true } } },
      });

      const permSet = new Set<string>();
      const permissions: Array<{ module: string; feature: string; action: string }> = [];
      for (const rp of rolePermissions) {
        if (!rp.permission?.isActive) continue;
        const key = `${rp.permission.module}:${rp.permission.feature}:${rp.permission.action}`;
        if (!permSet.has(key)) {
          permSet.add(key);
          permissions.push({ module: rp.permission.module, feature: rp.permission.feature, action: rp.permission.action });
        }
      }

      const result = { roles, permissions };

      // Cache for 15 min
      if (this.redis) {
        try { await this.redis.set(`aris:permissions:${caller.userId}`, JSON.stringify(result), 'EX', 900); } catch {}
      }

      return { data: result };
    } catch {
      // Tables may not exist yet
      return { data: { roles: [caller.role], permissions: [] } };
    }
  }

  async update(id: string, dto: Record<string, unknown>, caller: AuthenticatedUser): Promise<ApiResponse<any>> {
    const existing = await (this.prisma as any).user.findUnique({ where: { id }, select: { ...USER_SELECT, tenantId: true } });
    if (!existing) throw new HttpError(404, `User ${id} not found`);
    await this.verifyTenantAccess(caller, existing.tenantId);

    if (dto.role !== undefined && dto.role !== existing.role) {
      if (caller.role !== UserRole.SUPER_ADMIN) throw new HttpError(403, 'Only SUPER_ADMIN can change user roles');
    }

    const updateData: Record<string, unknown> = {};
    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.password !== undefined && typeof dto.password === 'string') {
      updateData.passwordHash = await bcrypt.hash(dto.password, 10);
      // Admin changed the password → treat as a temporary password: force
      // the user to change it again on their next login.
      updateData.mustChangePassword = true;
    }
    if (dto.firstName !== undefined) updateData.firstName = dto.firstName;
    if (dto.lastName !== undefined) updateData.lastName = dto.lastName;
    if (dto.role !== undefined) updateData.role = dto.role;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.locale !== undefined) updateData.locale = dto.locale;
    if (dto.avatarUrl !== undefined) updateData.avatarUrl = dto.avatarUrl;
    if (dto.tenantId !== undefined) {
      if (caller.role !== UserRole.SUPER_ADMIN) throw new HttpError(403, 'Only SUPER_ADMIN can change user tenant');
      updateData.tenantId = dto.tenantId;
    }

    const user = await (this.prisma as any).user.update({ where: { id }, data: updateData, select: USER_SELECT });

    // Update domain assignments if provided
    if (dto.domainIds !== undefined && this.domainService) {
      await this.domainService.setUserDomains(id, dto.domainIds as string[], caller.userId, caller.tenantId);
      // Re-fetch to get updated domains
      const refreshed = await (this.prisma as any).user.findUnique({ where: { id }, select: USER_SELECT });
      if (this.redis) {
        try { await this.redis.del(`aris:credential:user:${id}`); } catch { /* non-blocking */ }
      }
      return { data: this.transformUser(refreshed) };
    }

    // Invalidate cached profile
    if (this.redis) {
      try { await this.redis.del(`aris:credential:user:${id}`); } catch { /* non-blocking */ }
    }
    return { data: this.transformUser(user) };
  }

  async updateMe(caller: AuthenticatedUser, dto: Record<string, unknown>): Promise<ApiResponse<any>> {
    const updateData: Record<string, unknown> = {};
    if (dto.firstName !== undefined) updateData.firstName = dto.firstName;
    if (dto.lastName !== undefined) updateData.lastName = dto.lastName;
    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.avatarUrl !== undefined) updateData.avatarUrl = dto.avatarUrl;

    const user = await (this.prisma as any).user.update({
      where: { id: caller.userId },
      data: updateData,
      select: USER_SELECT,
    });
    if (this.redis) {
      try { await this.redis.del(`aris:credential:user:${caller.userId}`); } catch { /* non-blocking */ }
    }
    return { data: this.transformUser(user) };
  }

  /**
   * Self-service password change. Requires the current password for
   * verification, enforces strength rules on the new password, then
   * clears the mustChangePassword flag and bumps passwordChangedAt.
   */
  async changeMyPassword(
    caller: AuthenticatedUser,
    dto: { currentPassword: string; newPassword: string },
  ): Promise<ApiResponse<{ changed: true; mustChangePassword: false }>> {
    const { currentPassword, newPassword } = dto;

    if (newPassword === currentPassword) {
      throw new HttpError(400, 'New password must be different from the current password');
    }

    // Strength check: min length already enforced by schema (>=8); add
    // a basic complexity requirement (letters + digits).
    const hasLetter = /[A-Za-z]/.test(newPassword);
    const hasDigit = /\d/.test(newPassword);
    if (!hasLetter || !hasDigit) {
      throw new HttpError(400, 'Password must contain at least one letter and one digit');
    }

    const user = await (this.prisma as any).user.findUnique({
      where: { id: caller.userId },
      select: { id: true, passwordHash: true, isActive: true },
    });
    if (!user || !user.isActive) throw new HttpError(401, 'User not found or inactive');

    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) throw new HttpError(401, 'Current password is incorrect');

    const newHash = await bcrypt.hash(newPassword, 10);
    await (this.prisma as any).user.update({
      where: { id: caller.userId },
      data: {
        passwordHash: newHash,
        mustChangePassword: false,
        passwordChangedAt: new Date(),
      },
    });

    // Invalidate cached profile so the next /users/me call reflects the flag
    if (this.redis) {
      try { await this.redis.del(`aris:credential:user:${caller.userId}`); } catch { /* non-blocking */ }
    }

    return { data: { changed: true, mustChangePassword: false } };
  }

  async updateLocale(userId: string, locale: string): Promise<ApiResponse<any>> {
    const user = await (this.prisma as any).user.findUnique({ where: { id: userId } });
    if (!user) throw new HttpError(404, `User ${userId} not found`);
    const updated = await (this.prisma as any).user.update({ where: { id: userId }, data: { locale }, select: USER_SELECT });
    if (this.redis) {
      try { await this.redis.del(`aris:credential:user:${userId}`); } catch { /* non-blocking */ }
    }
    return { data: this.transformUser(updated) };
  }

  async delete(id: string, caller: AuthenticatedUser): Promise<ApiResponse<{ deleted: boolean }>> {
    const existing = await (this.prisma as any).user.findUnique({
      where: { id },
      select: { id: true, tenantId: true, lastLoginAt: true, email: true },
    });
    if (!existing) throw new HttpError(404, `User ${id} not found`);
    await this.verifyTenantAccess(caller, existing.tenantId);

    // Only allow hard-delete for users who never logged in
    if (existing.lastLoginAt) {
      throw new HttpError(400, 'Cannot delete a user who has logged in. Deactivate the account instead.');
    }

    // Delete user-domain assignments first (FK)
    await (this.prisma as any).userDomain.deleteMany({ where: { userId: id } });
    // Delete user-function assignments (FK)
    await (this.prisma as any).userFunction.deleteMany({ where: { userId: id } });
    // Delete the user
    await (this.prisma as any).user.delete({ where: { id } });

    if (this.redis) {
      try { await this.redis.del(`aris:credential:user:${id}`); } catch { /* non-blocking */ }
    }
    return { data: { deleted: true } };
  }

  private buildTenantFilter(caller: AuthenticatedUser): Record<string, unknown> {
    switch (caller.tenantLevel) {
      case TenantLevel.CONTINENTAL: return {};
      // REC admin sees: users in the REC tenant + users in child country tenants
      case TenantLevel.REC: return { tenant: { OR: [{ id: caller.tenantId }, { parentId: caller.tenantId }] } };
      // National admin sees only users in their own country tenant
      case TenantLevel.MEMBER_STATE: return { tenantId: caller.tenantId };
      default: return { tenantId: caller.tenantId };
    }
  }

  private async verifyTenantAccess(caller: AuthenticatedUser, targetTenantId: string): Promise<void> {
    if (caller.tenantLevel === TenantLevel.CONTINENTAL) return;
    if (caller.tenantId === targetTenantId) return;
    if (caller.tenantLevel === TenantLevel.REC) {
      // REC admin can modify users in child country tenants
      const target = await (this.prisma as any).tenant.findUnique({
        where: { id: targetTenantId },
        select: { parentId: true },
      });
      if (target?.parentId === caller.tenantId) return;
    }
    throw new HttpError(403, 'Cannot modify users in another tenant');
  }
}

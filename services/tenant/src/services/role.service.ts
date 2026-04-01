import { randomUUID } from 'crypto';
import type { PrismaClient, Prisma } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import type Redis from 'ioredis';
import type { KafkaHeaders } from '@aris/shared-types';

const SERVICE_NAME = 'tenant-service';
const TOPIC_SETTINGS_ROLE_UPDATED = 'sys.settings.role.updated.v1';

const CACHE_TTL_LIST = 300;
const CACHE_TTL_DETAIL = 600;

interface AuthenticatedUser {
  userId: string;
  email: string;
  role: string;
  roles?: string[];
  tenantId: string;
  tenantLevel: string;
}

class HttpError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export class RoleService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: StandaloneKafkaProducer,
    private readonly redis: Redis | null,
  ) {}

  // ───────────────────── Cache helpers ─────────────────────

  private async cacheGet<T>(key: string): Promise<T | null> {
    if (!this.redis) return null;
    try {
      const cached = await this.redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch { return null; }
  }

  private async cacheSet(key: string, value: unknown, ttl: number): Promise<void> {
    if (!this.redis) return;
    try { await this.redis.set(key, JSON.stringify(value), 'EX', ttl); } catch {}
  }

  private async cacheInvalidate(pattern: string): Promise<void> {
    if (!this.redis) return;
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) await this.redis.del(...keys);
    } catch {}
  }

  // ───────────────────── Roles CRUD ─────────────────────

  async listRoles(query: {
    search?: string; level?: string; status?: string;
    page?: number; limit?: number;
  }, caller: AuthenticatedUser) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    const andConditions: Record<string, unknown>[] = [];

    // Show global system roles + tenant-scoped roles
    if (caller.tenantLevel !== 'CONTINENTAL') {
      andConditions.push({
        OR: [
          { tenantId: null },         // global system roles
          { tenantId: caller.tenantId }, // tenant-specific custom roles
        ],
      });
    }

    if (query.search) {
      andConditions.push({
        OR: [
          { code: { contains: query.search, mode: 'insensitive' } },
        ],
      });
    }
    if (andConditions.length > 0) where.AND = andConditions;
    if (query.level) where.level = query.level;
    if (query.status === 'active') where.isActive = true;
    if (query.status === 'inactive') where.isActive = false;

    const [data, total] = await Promise.all([
      (this.prisma as any).role.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        include: {
          _count: {
            select: { userRoles: true, functionRoles: true },
          },
        },
      }),
      (this.prisma as any).role.count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  async getRoleById(id: string) {
    const cacheKey = `aris:settings:roles:${id}`;
    const cached = await this.cacheGet<{ data: any }>(cacheKey);
    if (cached) return cached;

    const role = await (this.prisma as any).role.findUnique({
      where: { id },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
        _count: {
          select: { userRoles: true, functionRoles: true },
        },
      },
    });
    if (!role) throw new HttpError(404, `Role ${id} not found`);

    const result = { data: role };
    await this.cacheSet(cacheKey, result, CACHE_TTL_DETAIL);
    return result;
  }

  async createRole(dto: Record<string, unknown>, caller: AuthenticatedUser) {
    const code = dto.code as string;

    // Check uniqueness within tenant scope
    const existing = await (this.prisma as any).role.findFirst({
      where: { code, tenantId: caller.tenantLevel === 'CONTINENTAL' ? null : caller.tenantId },
    });
    if (existing) throw new HttpError(409, `Role with code "${code}" already exists`);

    const role = await (this.prisma as any).role.create({
      data: {
        code,
        name: (dto.name ?? {}) as Prisma.InputJsonValue,
        description: (dto.description ?? null) as Prisma.InputJsonValue,
        level: dto.level as string,
        color: (dto.color as string) ?? '#6b7280',
        icon: (dto.icon as string) ?? 'Shield',
        isActive: (dto.isActive as boolean) ?? true,
        sortOrder: (dto.sortOrder as number) ?? 0,
        isSystem: false,
        tenantId: caller.tenantLevel === 'CONTINENTAL' ? null : caller.tenantId,
        metadata: (dto.metadata ?? null) as Prisma.InputJsonValue,
      },
    });

    await this.publishEvent(TOPIC_SETTINGS_ROLE_UPDATED, { ...role, action: 'created' }, caller);
    await this.invalidateRoleCache();
    return { data: role };
  }

  async updateRole(id: string, dto: Record<string, unknown>, caller: AuthenticatedUser) {
    const existing = await (this.prisma as any).role.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, `Role ${id} not found`);

    // System roles: only allow updating permissions, name, description, color, icon
    const updateData: Record<string, unknown> = {};
    if (dto.name !== undefined) updateData.name = dto.name as Prisma.InputJsonValue;
    if (dto.description !== undefined) updateData.description = dto.description as Prisma.InputJsonValue;
    if (dto.color !== undefined) updateData.color = dto.color;
    if (dto.icon !== undefined) updateData.icon = dto.icon;
    if (dto.sortOrder !== undefined) updateData.sortOrder = dto.sortOrder;
    if (dto.metadata !== undefined) updateData.metadata = dto.metadata as Prisma.InputJsonValue;

    // Non-system roles can also update level and isActive
    if (!existing.isSystem) {
      if (dto.level !== undefined) updateData.level = dto.level;
      if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    }

    const role = await (this.prisma as any).role.update({
      where: { id },
      data: updateData,
    });

    await this.publishEvent(TOPIC_SETTINGS_ROLE_UPDATED, { ...role, action: 'updated' }, caller);
    await this.invalidateRoleCache();
    return { data: role };
  }

  async deleteRole(id: string, caller: AuthenticatedUser) {
    const existing = await (this.prisma as any).role.findUnique({
      where: { id },
      include: { _count: { select: { userRoles: true } } },
    });
    if (!existing) throw new HttpError(404, `Role ${id} not found`);
    if (existing.isSystem) throw new HttpError(400, 'Cannot delete a system role');
    if (existing._count.userRoles > 0) {
      throw new HttpError(409, `Cannot delete role with ${existing._count.userRoles} assigned users`);
    }

    await (this.prisma as any).role.delete({ where: { id } });
    await this.publishEvent(TOPIC_SETTINGS_ROLE_UPDATED, { id, action: 'deleted' }, caller);
    await this.invalidateRoleCache();
    return { data: { id, deleted: true } };
  }

  // ───────────────────── Permissions ─────────────────────

  async listPermissions(query: { module?: string; feature?: string }) {
    const cacheKey = `aris:settings:permissions:list:${JSON.stringify(query)}`;
    const cached = await this.cacheGet<{ data: any[] }>(cacheKey);
    if (cached) return cached;

    const where: Record<string, unknown> = { isActive: true };
    if (query.module) where.module = query.module;
    if (query.feature) where.feature = query.feature;

    const data = await (this.prisma as any).permission.findMany({
      where,
      orderBy: [{ module: 'asc' }, { feature: 'asc' }, { action: 'asc' }],
    });

    const result = { data };
    await this.cacheSet(cacheKey, result, CACHE_TTL_LIST);
    return result;
  }

  async updateRolePermissions(roleId: string, permissionIds: string[], caller: AuthenticatedUser) {
    const role = await (this.prisma as any).role.findUnique({ where: { id: roleId } });
    if (!role) throw new HttpError(404, `Role ${roleId} not found`);

    // Delete all existing and recreate
    await (this.prisma as any).rolePermission.deleteMany({ where: { roleId } });

    if (permissionIds.length > 0) {
      await (this.prisma as any).rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({
          roleId,
          permissionId,
        })),
        skipDuplicates: true,
      });
    }

    await this.publishEvent(TOPIC_SETTINGS_ROLE_UPDATED, {
      id: roleId,
      action: 'permissions_updated',
      permissionCount: permissionIds.length,
    }, caller);
    await this.invalidateRoleCache();
    await this.invalidatePermissionCache();

    return { data: { roleId, permissionCount: permissionIds.length } };
  }

  // ───────────────────── Cache ─────────────────────

  private async invalidateRoleCache(): Promise<void> {
    await Promise.all([
      this.cacheInvalidate('aris:settings:roles:*'),
      this.cacheInvalidate('aris:permissions:*'),
    ]);
  }

  private async invalidatePermissionCache(): Promise<void> {
    await Promise.all([
      this.cacheInvalidate('aris:settings:permissions:*'),
      this.cacheInvalidate('aris:permissions:*'),
    ]);
  }

  // ───────────────────── Kafka ─────────────────────

  private async publishEvent(
    topic: string,
    payload: Record<string, unknown>,
    user: AuthenticatedUser,
  ): Promise<void> {
    const headers: KafkaHeaders = {
      correlationId: randomUUID(),
      sourceService: SERVICE_NAME,
      tenantId: user.tenantId,
      userId: user.userId,
      schemaVersion: '1',
      timestamp: new Date().toISOString(),
    };
    try {
      const key = (payload.id as string) ?? randomUUID();
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Kafka send timeout')), 5000),
      );
      await Promise.race([this.kafka.send(topic, key, payload, headers), timeout]);
    } catch {
      // Non-blocking
    }
  }
}

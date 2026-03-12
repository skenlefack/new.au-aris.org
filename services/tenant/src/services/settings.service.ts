import { randomUUID } from 'crypto';
import { hash } from 'bcrypt';
import type { PrismaClient, Prisma } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import type Redis from 'ioredis';
import {
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from '@aris/shared-types';
import type { KafkaHeaders } from '@aris/shared-types';

const SERVICE_NAME = 'tenant-service';

const TOPIC_SETTINGS_REC_UPDATED = 'sys.settings.rec.updated.v1';
const TOPIC_SETTINGS_COUNTRY_UPDATED = 'sys.settings.country.updated.v1';
const TOPIC_SETTINGS_CONFIG_UPDATED = 'sys.settings.config.updated.v1';
const TOPIC_SETTINGS_DOMAIN_UPDATED = 'sys.settings.domain.updated.v1';
const TOPIC_SETTINGS_FUNCTION_UPDATED = 'sys.settings.function.updated.v1';
const TOPIC_SETTINGS_USER_UPDATED = 'sys.settings.user.updated.v1';

const BCRYPT_ROUNDS = 12;

// Cache TTLs (seconds)
const CACHE_TTL_PUBLIC = 120;     // 2 minutes for public endpoints
const CACHE_TTL_LIST = 300;       // 5 minutes for list endpoints
const CACHE_TTL_DETAIL = 600;     // 10 minutes for individual lookups
const CACHE_TTL_SCOPE = 600;      // 10 minutes for user scope

interface AuthenticatedUser {
  userId: string;
  email: string;
  role: string;
  tenantId: string;
  tenantLevel: string;
  locale?: string;
}

/** Resolved scope of visible RECs and countries for a user */
interface UserScope {
  all: boolean;
  recCodes: string[];
  countryCodes: string[];
}

class HttpError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class SettingsService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: StandaloneKafkaProducer,
    private readonly redis: Redis,
  ) {}

  // ───────────────────── Cache helpers ─────────────────────

  private async cacheGet<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.redis.get(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private async cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
      // Cache write failure is non-blocking
    }
  }

  private async cacheInvalidate(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) await this.redis.del(...keys);
    } catch {
      // Cache invalidation failure is non-blocking
    }
  }

  // ───────────────────── User Scope ─────────────────────

  /**
   * Resolve the user's accessible scope based on their tenant.
   * CONTINENTAL → all RECs and countries
   * REC → only RECs matching the tenant's recCode + countries in those RECs
   * MEMBER_STATE → only country matching tenantId + RECs that country belongs to
   */
  async getUserScope(user?: AuthenticatedUser): Promise<UserScope> {
    if (!user) return { all: true, recCodes: [], countryCodes: [] };

    const level = user.tenantLevel;
    if (level === 'CONTINENTAL') return { all: true, recCodes: [], countryCodes: [] };

    const cacheKey = `aris:scope:${user.tenantId}`;
    const cached = await this.cacheGet<UserScope>(cacheKey);
    if (cached) return cached;

    const tenant = await (this.prisma as any).tenant.findUnique({
      where: { id: user.tenantId },
      select: { level: true, countryCode: true, recCode: true },
    });
    if (!tenant) return { all: false, recCodes: [], countryCodes: [] };

    let scope: UserScope;

    if (tenant.level === 'REC' && tenant.recCode) {
      // REC-level: find all countries in this REC
      const links = await (this.prisma as any).countryRec.findMany({
        where: { rec: { code: tenant.recCode } },
        select: { country: { select: { code: true } } },
      });
      const countryCodes = links.map((l: any) => l.country.code as string);
      scope = { all: false, recCodes: [tenant.recCode], countryCodes };
    } else if (tenant.level === 'MEMBER_STATE' && tenant.countryCode) {
      // Country-level: find RECs this country belongs to
      const links = await (this.prisma as any).countryRec.findMany({
        where: { country: { code: tenant.countryCode } },
        select: { rec: { select: { code: true } } },
      });
      const recCodes = links.map((l: any) => l.rec.code as string);
      scope = { all: false, recCodes, countryCodes: [tenant.countryCode] };
    } else {
      scope = { all: false, recCodes: [], countryCodes: [] };
    }

    await this.cacheSet(cacheKey, scope, CACHE_TTL_SCOPE);
    return scope;
  }

  // ───────────────────── RECs ─────────────────────

  async listRecs(query: {
    page?: number; limit?: number; sort?: string; order?: string;
    search?: string; status?: string;
  }, user?: AuthenticatedUser) {
    const scope = await this.getUserScope(user);

    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;
    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'asc' }
      : { sortOrder: 'asc' as const };

    const where: Record<string, unknown> = {};
    if (query.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { headquarters: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.status === 'active') where.isActive = true;
    if (query.status === 'inactive') where.isActive = false;

    // Access-level filtering: restrict RECs based on user scope
    if (!scope.all && scope.recCodes.length > 0) {
      where.code = { in: scope.recCodes };
    } else if (!scope.all && scope.recCodes.length === 0) {
      // No visible RECs → return empty
      return { data: [], meta: { total: 0, page, limit } };
    }

    // Cache: list queries with same params + scope
    const scopeTag = scope.all ? 'all' : scope.recCodes.join(',');
    const cacheKey = `aris:settings:recs:list:${scopeTag}:${JSON.stringify({ where, skip, limit, orderBy })}`;
    const cached = await this.cacheGet<{ data: any[]; meta: any }>(cacheKey);
    if (cached) return cached;

    const [data, total] = await Promise.all([
      (this.prisma as any).rec.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: { _count: { select: { countries: true } } },
      }),
      (this.prisma as any).rec.count({ where }),
    ]);

    const result = { data, meta: { total, page, limit } };
    await this.cacheSet(cacheKey, result, CACHE_TTL_LIST);
    return result;
  }

  private readonly recInclude = {
    countries: {
      include: { country: { select: { id: true, code: true, name: true, flag: true, capital: true, isOperational: true } } },
      orderBy: { country: { sortOrder: 'asc' as const } },
    },
    _count: { select: { countries: true } },
  };

  async getRecByCode(code: string) {
    const rec = await (this.prisma as any).rec.findUnique({
      where: { code },
      include: this.recInclude,
    });
    if (!rec) throw new HttpError(404, `REC with code "${code}" not found`);
    return { data: rec };
  }

  async getRecByIdOrCode(idOrCode: string, user?: AuthenticatedUser) {
    const cacheKey = `aris:settings:recs:detail:${idOrCode}`;
    const cached = await this.cacheGet<{ data: any }>(cacheKey);
    if (cached) {
      // Still enforce scope check on cached data
      const scope = await this.getUserScope(user);
      if (!scope.all && !scope.recCodes.includes(cached.data.code)) {
        throw new HttpError(403, 'Access denied: REC is outside your scope');
      }
      return cached;
    }

    // Use code or UUID lookup depending on format
    const isUuid = UUID_REGEX.test(idOrCode);
    const where = isUuid ? { OR: [{ code: idOrCode }, { id: idOrCode }] } : { code: idOrCode };
    const rec = await (this.prisma as any).rec.findFirst({
      where,
      include: this.recInclude,
    });
    if (!rec) throw new HttpError(404, `REC "${idOrCode}" not found`);

    // Access-level check
    const scope = await this.getUserScope(user);
    if (!scope.all && !scope.recCodes.includes(rec.code)) {
      throw new HttpError(403, 'Access denied: REC is outside your scope');
    }

    const result = { data: rec };
    await this.cacheSet(cacheKey, result, CACHE_TTL_DETAIL);
    return result;
  }

  async createRec(dto: Record<string, unknown>, user: AuthenticatedUser) {
    const existing = await (this.prisma as any).rec.findUnique({
      where: { code: dto.code as string },
    });
    if (existing) throw new HttpError(409, `REC with code "${dto.code}" already exists`);

    const rec = await (this.prisma as any).rec.create({
      data: {
        code: dto.code as string,
        name: (dto.name ?? {}) as Prisma.InputJsonValue,
        fullName: (dto.fullName ?? {}) as Prisma.InputJsonValue,
        description: (dto.description ?? {}) as Prisma.InputJsonValue,
        region: (dto.region ?? {}) as Prisma.InputJsonValue,
        headquarters: (dto.headquarters as string) ?? null,
        established: dto.established != null ? Number(dto.established) : null,
        accentColor: (dto.accentColor as string) ?? null,
        logoUrl: (dto.logoUrl as string) ?? null,
        website: (dto.website as string) ?? null,
        isActive: (dto.isActive as boolean) ?? true,
        sortOrder: (dto.sortOrder as number) ?? 0,
        stats: (dto.stats ?? {}) as Prisma.InputJsonValue,
        metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });

    await this.publishEvent(TOPIC_SETTINGS_REC_UPDATED, { ...rec, action: 'created' }, user);
    await this.invalidateRecCache();
    return { data: rec };
  }

  async updateRec(id: string, dto: Record<string, unknown>, user: AuthenticatedUser) {
    const updateData: Record<string, unknown> = {};
    if (dto.name !== undefined) updateData.name = dto.name as Prisma.InputJsonValue;
    if (dto.fullName !== undefined) updateData.fullName = dto.fullName as Prisma.InputJsonValue;
    if (dto.description !== undefined) updateData.description = dto.description as Prisma.InputJsonValue;
    if (dto.region !== undefined) updateData.region = dto.region as Prisma.InputJsonValue;
    if (dto.headquarters !== undefined) updateData.headquarters = dto.headquarters;
    if (dto.established !== undefined) updateData.established = dto.established;
    if (dto.accentColor !== undefined) updateData.accentColor = dto.accentColor;
    if (dto.logoUrl !== undefined) updateData.logoUrl = dto.logoUrl;
    if (dto.website !== undefined) updateData.website = dto.website;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.sortOrder !== undefined) updateData.sortOrder = dto.sortOrder;
    if (dto.stats !== undefined) updateData.stats = dto.stats as Prisma.InputJsonValue;
    if (dto.metadata !== undefined) updateData.metadata = dto.metadata as Prisma.InputJsonValue;

    try {
      const rec = await (this.prisma as any).rec.update({
        where: { id },
        data: updateData,
      });

      await this.publishEvent(TOPIC_SETTINGS_REC_UPDATED, { ...rec, action: 'updated' }, user);
      await this.invalidateRecCache();
      return { data: rec };
    } catch (err: any) {
      if (err.code === 'P2025') throw new HttpError(404, `REC ${id} not found`);
      throw err;
    }
  }

  async deleteRec(id: string, user: AuthenticatedUser) {
    const existing = await (this.prisma as any).rec.findUnique({
      where: { id },
      include: { _count: { select: { countries: true } } },
    });
    if (!existing) throw new HttpError(404, `REC ${id} not found`);
    if (existing._count.countries > 0) {
      throw new HttpError(409, `Cannot delete REC with ${existing._count.countries} associated countries`);
    }

    await (this.prisma as any).rec.delete({ where: { id } });
    await this.publishEvent(TOPIC_SETTINGS_REC_UPDATED, { id, action: 'deleted' }, user);
    await this.invalidateRecCache();
    return { data: { id, deleted: true } };
  }

  async updateRecSort(id: string, sortOrder: number, user: AuthenticatedUser) {
    try {
      const rec = await (this.prisma as any).rec.update({
        where: { id },
        data: { sortOrder },
      });
      await this.publishEvent(TOPIC_SETTINGS_REC_UPDATED, { ...rec, action: 'sort_updated' }, user);
      await this.invalidateRecCache();
      return { data: rec };
    } catch (err: any) {
      if (err.code === 'P2025') throw new HttpError(404, `REC ${id} not found`);
      throw err;
    }
  }

  async updateRecStats(id: string, stats: Record<string, unknown>, user: AuthenticatedUser) {
    try {
      const rec = await (this.prisma as any).rec.update({
        where: { id },
        data: { stats: stats as Prisma.InputJsonValue },
      });
      await this.publishEvent(TOPIC_SETTINGS_REC_UPDATED, { ...rec, action: 'stats_updated' }, user);
      await this.invalidateRecCache();
      return { data: rec };
    } catch (err: any) {
      if (err.code === 'P2025') throw new HttpError(404, `REC ${id} not found`);
      throw err;
    }
  }

  // ───────────────────── Countries ─────────────────────

  async listCountries(query: {
    page?: number; limit?: number; sort?: string; order?: string;
    search?: string; status?: string; recCode?: string;
  }, user?: AuthenticatedUser) {
    const scope = await this.getUserScope(user);

    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;
    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'asc' }
      : { sortOrder: 'asc' as const };

    const where: Record<string, unknown> = {};
    if (query.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { name: { path: ['en'], string_contains: query.search } },
        { capital: { path: ['en'], string_contains: query.search } },
      ];
    }
    if (query.status === 'active') where.isActive = true;
    if (query.status === 'inactive') where.isActive = false;
    if (query.status === 'operational') where.isOperational = true;
    if (query.recCode) {
      where.recs = { some: { rec: { code: query.recCode } } };
    }

    // Access-level filtering: restrict countries based on user scope
    if (!scope.all && scope.countryCodes.length > 0) {
      where.code = { in: scope.countryCodes };
    } else if (!scope.all && scope.countryCodes.length === 0) {
      return { data: [], meta: { total: 0, page, limit } };
    }

    const scopeTag = scope.all ? 'all' : scope.countryCodes.join(',');
    const cacheKey = `aris:settings:countries:list:${scopeTag}:${JSON.stringify({ where, skip, limit, orderBy })}`;
    const cached = await this.cacheGet<{ data: any[]; meta: any }>(cacheKey);
    if (cached) return cached;

    const [data, total] = await Promise.all([
      (this.prisma as any).country.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: { recs: { include: { rec: { select: { code: true, name: true } } } } },
      }),
      (this.prisma as any).country.count({ where }),
    ]);

    const result = { data, meta: { total, page, limit } };
    await this.cacheSet(cacheKey, result, CACHE_TTL_LIST);
    return result;
  }

  async getCountryByCode(code: string) {
    const country = await (this.prisma as any).country.findUnique({
      where: { code },
      include: { recs: { include: { rec: { select: { id: true, code: true, name: true } } } } },
    });
    if (!country) throw new HttpError(404, `Country with code "${code}" not found`);
    return { data: country };
  }

  async getCountryByIdOrCode(idOrCode: string, user?: AuthenticatedUser) {
    const cacheKey = `aris:settings:countries:detail:${idOrCode}`;
    const cached = await this.cacheGet<{ data: any }>(cacheKey);
    if (cached) {
      const scope = await this.getUserScope(user);
      if (!scope.all && !scope.countryCodes.includes(cached.data.code)) {
        throw new HttpError(403, 'Access denied: Country is outside your scope');
      }
      return cached;
    }

    const countryInclude = { recs: { include: { rec: { select: { id: true, code: true, name: true } } } } };
    // Use code or UUID lookup depending on format
    const isUuid = UUID_REGEX.test(idOrCode);
    const where = isUuid ? { OR: [{ code: idOrCode }, { id: idOrCode }] } : { code: idOrCode };
    const country = await (this.prisma as any).country.findFirst({
      where,
      include: countryInclude,
    });
    if (!country) throw new HttpError(404, `Country "${idOrCode}" not found`);

    // Access-level check
    const scope = await this.getUserScope(user);
    if (!scope.all && !scope.countryCodes.includes(country.code)) {
      throw new HttpError(403, 'Access denied: Country is outside your scope');
    }

    const result = { data: country };
    await this.cacheSet(cacheKey, result, CACHE_TTL_DETAIL);
    return result;
  }

  async createCountry(dto: Record<string, unknown>, user: AuthenticatedUser) {
    const existing = await (this.prisma as any).country.findUnique({
      where: { code: dto.code as string },
    });
    if (existing) throw new HttpError(409, `Country with code "${dto.code}" already exists`);

    const country = await (this.prisma as any).country.create({
      data: {
        code: dto.code as string,
        name: (dto.name ?? {}) as Prisma.InputJsonValue,
        officialName: (dto.officialName ?? null) as Prisma.InputJsonValue,
        capital: (dto.capital ?? {}) as Prisma.InputJsonValue,
        flag: (dto.flag as string) ?? null,
        population: dto.population != null ? Number(dto.population) : null,
        area: dto.area != null ? Number(dto.area) : null,
        timezone: (dto.timezone as string) ?? null,
        languages: (dto.languages ?? []) as Prisma.InputJsonValue,
        currency: (dto.currency as string) ?? null,
        phoneCode: (dto.phoneCode as string) ?? null,
        isActive: (dto.isActive as boolean) ?? true,
        isOperational: (dto.isOperational as boolean) ?? false,
        tenantId: (dto.tenantId as string) ?? null,
        sortOrder: (dto.sortOrder as number) ?? 0,
        stats: (dto.stats ?? {}) as Prisma.InputJsonValue,
        sectorPerformance: (dto.sectorPerformance ?? {}) as Prisma.InputJsonValue,
        metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });

    await this.publishEvent(TOPIC_SETTINGS_COUNTRY_UPDATED, { ...country, action: 'created' }, user);
    await this.invalidateCountryCache();
    return { data: country };
  }

  async updateCountry(id: string, dto: Record<string, unknown>, user: AuthenticatedUser) {
    const updateData: Record<string, unknown> = {};
    if (dto.code !== undefined) updateData.code = dto.code;
    if (dto.name !== undefined) updateData.name = dto.name as Prisma.InputJsonValue;
    if (dto.officialName !== undefined) updateData.officialName = dto.officialName as Prisma.InputJsonValue;
    if (dto.capital !== undefined) updateData.capital = dto.capital as Prisma.InputJsonValue;
    if (dto.flag !== undefined) updateData.flag = dto.flag;
    if (dto.population !== undefined) updateData.population = dto.population != null ? Number(dto.population) : null;
    if (dto.area !== undefined) updateData.area = dto.area != null ? Number(dto.area) : null;
    if (dto.timezone !== undefined) updateData.timezone = dto.timezone;
    if (dto.languages !== undefined) updateData.languages = dto.languages as Prisma.InputJsonValue;
    if (dto.currency !== undefined) updateData.currency = dto.currency;
    if (dto.phoneCode !== undefined) updateData.phoneCode = dto.phoneCode;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.isOperational !== undefined) updateData.isOperational = dto.isOperational;
    if (dto.tenantId !== undefined) updateData.tenantId = dto.tenantId;
    if (dto.sortOrder !== undefined) updateData.sortOrder = dto.sortOrder;
    if (dto.stats !== undefined) updateData.stats = dto.stats as Prisma.InputJsonValue;
    if (dto.sectorPerformance !== undefined) updateData.sectorPerformance = dto.sectorPerformance as Prisma.InputJsonValue;
    if (dto.metadata !== undefined) updateData.metadata = dto.metadata as Prisma.InputJsonValue;

    try {
      const country = await (this.prisma as any).country.update({
        where: { id },
        data: updateData,
      });
      await this.publishEvent(TOPIC_SETTINGS_COUNTRY_UPDATED, { ...country, action: 'updated' }, user);
      await this.invalidateCountryCache();
      return { data: country };
    } catch (err: any) {
      if (err.code === 'P2025') throw new HttpError(404, `Country ${id} not found`);
      throw err;
    }
  }

  async deleteCountry(id: string, user: AuthenticatedUser) {
    try {
      await (this.prisma as any).country.delete({ where: { id } });
      await this.publishEvent(TOPIC_SETTINGS_COUNTRY_UPDATED, { id, action: 'deleted' }, user);
      await this.invalidateCountryCache();
      return { data: { id, deleted: true } };
    } catch (err: any) {
      if (err.code === 'P2025') throw new HttpError(404, `Country ${id} not found`);
      throw err;
    }
  }

  async updateCountryStats(id: string, stats: Record<string, unknown>, user: AuthenticatedUser) {
    try {
      const country = await (this.prisma as any).country.update({
        where: { id },
        data: { stats: stats as Prisma.InputJsonValue },
      });
      await this.publishEvent(TOPIC_SETTINGS_COUNTRY_UPDATED, { ...country, action: 'stats_updated' }, user);
      await this.invalidateCountryCache();
      return { data: country };
    } catch (err: any) {
      if (err.code === 'P2025') throw new HttpError(404, `Country ${id} not found`);
      throw err;
    }
  }

  async updateCountrySectors(id: string, sectors: Record<string, unknown>, user: AuthenticatedUser) {
    try {
      const country = await (this.prisma as any).country.update({
        where: { id },
        data: { sectorPerformance: sectors as Prisma.InputJsonValue },
      });
      await this.publishEvent(TOPIC_SETTINGS_COUNTRY_UPDATED, { ...country, action: 'sectors_updated' }, user);
      await this.invalidateCountryCache();
      return { data: country };
    } catch (err: any) {
      if (err.code === 'P2025') throw new HttpError(404, `Country ${id} not found`);
      throw err;
    }
  }

  async addCountryRec(countryId: string, recId: string) {
    const country = await (this.prisma as any).country.findUnique({ where: { id: countryId } });
    if (!country) throw new HttpError(404, `Country ${countryId} not found`);

    const rec = await (this.prisma as any).rec.findUnique({ where: { id: recId } });
    if (!rec) throw new HttpError(404, `REC ${recId} not found`);

    const existing = await (this.prisma as any).countryRec.findUnique({
      where: { countryId_recId: { countryId, recId } },
    });
    if (existing) throw new HttpError(409, 'Country is already associated with this REC');

    const link = await (this.prisma as any).countryRec.create({
      data: { countryId, recId },
    });

    return { data: link };
  }

  async removeCountryRec(countryId: string, recId: string) {
    const existing = await (this.prisma as any).countryRec.findUnique({
      where: { countryId_recId: { countryId, recId } },
    });
    if (!existing) throw new HttpError(404, 'Country-REC association not found');

    await (this.prisma as any).countryRec.delete({
      where: { countryId_recId: { countryId, recId } },
    });

    return { data: { countryId, recId, deleted: true } };
  }

  // ───────────────────── Admin Levels ─────────────────────

  async listAdminLevels(countryId: string) {
    const cacheKey = `aris:settings:admin-levels:${countryId}`;
    const cached = await this.cacheGet<{ data: any[] }>(cacheKey);
    if (cached) return cached;

    const levels = await (this.prisma as any).adminLevel.findMany({
      where: { countryId },
      orderBy: { level: 'asc' },
    });

    const result = { data: levels };
    await this.cacheSet(cacheKey, result, CACHE_TTL_DETAIL);
    return result;
  }

  async upsertAdminLevels(
    countryId: string,
    levels: Array<{ level: number; name: Record<string, string>; code: string; isActive?: boolean }>,
    user: AuthenticatedUser,
  ) {
    // Verify country exists
    const country = await (this.prisma as any).country.findUnique({ where: { id: countryId } });
    if (!country) throw new HttpError(404, `Country ${countryId} not found`);

    // Delete existing levels for this country, then create new ones (atomic replace)
    await (this.prisma as any).$transaction(async (tx: any) => {
      await tx.adminLevel.deleteMany({ where: { countryId } });
      await tx.adminLevel.createMany({
        data: levels.map((l) => ({
          countryId,
          level: l.level,
          name: l.name,
          code: l.code,
          isActive: l.isActive ?? true,
        })),
      });
    });

    await this.cacheInvalidate(`aris:settings:admin-levels:${countryId}`);

    const created = await (this.prisma as any).adminLevel.findMany({
      where: { countryId },
      orderBy: { level: 'asc' },
    });

    await this.publishEvent(TOPIC_SETTINGS_COUNTRY_UPDATED, {
      countryId,
      action: 'admin_levels_updated',
      levels: created.length,
    }, user);

    return { data: created };
  }

  async deleteAdminLevel(countryId: string, level: number, user: AuthenticatedUser) {
    const existing = await (this.prisma as any).adminLevel.findUnique({
      where: { countryId_level: { countryId, level } },
    });
    if (!existing) throw new HttpError(404, `Admin level ${level} not found for country ${countryId}`);

    await (this.prisma as any).adminLevel.delete({
      where: { countryId_level: { countryId, level } },
    });

    await this.cacheInvalidate(`aris:settings:admin-levels:${countryId}`);

    await this.publishEvent(TOPIC_SETTINGS_COUNTRY_UPDATED, {
      countryId,
      action: 'admin_level_deleted',
      level,
    }, user);

    return { data: { countryId, level, deleted: true } };
  }

  // ───────────────────── Config ─────────────────────

  async listConfigs(category?: string) {
    const cacheKey = `aris:settings:config:list:${category ?? 'all'}`;
    const cached = await this.cacheGet<{ data: any[] }>(cacheKey);
    if (cached) return cached;

    const where: Record<string, unknown> = {};
    if (category) where.category = category;

    const configs = await (this.prisma as any).systemConfig.findMany({
      where,
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });

    const result = { data: configs };
    await this.cacheSet(cacheKey, result, CACHE_TTL_LIST);
    return result;
  }

  async getConfig(category: string, key: string) {
    const config = await (this.prisma as any).systemConfig.findUnique({
      where: { category_key: { category, key } },
    });
    if (!config) throw new HttpError(404, `Config "${category}.${key}" not found`);
    return { data: config };
  }

  async updateConfig(category: string, key: string, value: unknown, user: AuthenticatedUser) {
    const config = await (this.prisma as any).systemConfig.upsert({
      where: { category_key: { category, key } },
      update: {
        value: value as Prisma.InputJsonValue,
        updatedBy: user.userId,
      },
      create: {
        category,
        key,
        value: value as Prisma.InputJsonValue,
        updatedBy: user.userId,
      },
    });

    await this.publishEvent(TOPIC_SETTINGS_CONFIG_UPDATED, { category, key, value, action: 'updated' }, user);
    await this.cacheInvalidate('aris:settings:config:*');
    return { data: config };
  }

  async bulkUpdateConfigs(
    configs: Array<{ category: string; key: string; value: unknown }>,
    user: AuthenticatedUser,
  ) {
    const results = await Promise.all(
      configs.map((c) =>
        (this.prisma as any).systemConfig.upsert({
          where: { category_key: { category: c.category, key: c.key } },
          update: {
            value: c.value as Prisma.InputJsonValue,
            updatedBy: user.userId,
          },
          create: {
            category: c.category,
            key: c.key,
            value: c.value as Prisma.InputJsonValue,
            updatedBy: user.userId,
          },
        }),
      ),
    );

    await this.publishEvent(
      TOPIC_SETTINGS_CONFIG_UPDATED,
      { configs: configs.map((c) => `${c.category}.${c.key}`), action: 'bulk_updated' },
      user,
    );
    await this.cacheInvalidate('aris:settings:config:*');
    return { data: results };
  }

  // ───────────────────── Domains ─────────────────────

  async listDomains() {
    const cacheKey = 'aris:settings:domains:list';
    const cached = await this.cacheGet<{ data: any[] }>(cacheKey);
    if (cached) return cached;

    const domains = await (this.prisma as any).domain.findMany({
      orderBy: { sortOrder: 'asc' },
    });

    const result = { data: domains };
    await this.cacheSet(cacheKey, result, CACHE_TTL_LIST);
    return result;
  }

  async updateDomain(id: string, dto: Record<string, unknown>, user: AuthenticatedUser) {
    const existing = await (this.prisma as any).domain.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, `Domain ${id} not found`);

    const updateData: Record<string, unknown> = {};
    if (dto.name !== undefined) updateData.name = dto.name as Prisma.InputJsonValue;
    if (dto.description !== undefined) updateData.description = dto.description as Prisma.InputJsonValue;
    if (dto.icon !== undefined) updateData.icon = dto.icon;
    if (dto.color !== undefined) updateData.color = dto.color;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.sortOrder !== undefined) updateData.sortOrder = dto.sortOrder;
    if (dto.metadata !== undefined) updateData.metadata = dto.metadata as Prisma.InputJsonValue;

    const domain = await (this.prisma as any).domain.update({
      where: { id },
      data: updateData,
    });

    await this.cacheInvalidate('aris:settings:domains:*');
    await this.cacheInvalidate('aris:public:domains');
    return { data: domain };
  }

  async updateDomainSort(items: Array<{ id: string; sortOrder: number }>, user: AuthenticatedUser) {
    const results = await Promise.all(
      items.map((item) =>
        (this.prisma as any).domain.update({
          where: { id: item.id },
          data: { sortOrder: item.sortOrder },
        }),
      ),
    );

    await this.cacheInvalidate('aris:settings:domains:*');
    await this.cacheInvalidate('aris:public:domains');
    return { data: results };
  }

  async createDomain(dto: Record<string, unknown>, user: AuthenticatedUser) {
    const existing = await (this.prisma as any).domain.findUnique({
      where: { code: dto.code as string },
    });
    if (existing) throw new HttpError(409, `Domain with code "${dto.code}" already exists`);

    const domain = await (this.prisma as any).domain.create({
      data: {
        code: dto.code as string,
        name: (dto.name ?? {}) as Prisma.InputJsonValue,
        description: (dto.description ?? null) as Prisma.InputJsonValue,
        icon: (dto.icon as string) ?? 'Layers',
        color: (dto.color as string) ?? '#003399',
        isActive: (dto.isActive as boolean) ?? true,
        sortOrder: (dto.sortOrder as number) ?? 0,
        metadata: (dto.metadata ?? null) as Prisma.InputJsonValue,
      },
    });

    await this.publishEvent(TOPIC_SETTINGS_DOMAIN_UPDATED, { ...domain, action: 'created' }, user);
    await this.cacheInvalidate('aris:settings:domains:*');
    await this.cacheInvalidate('aris:public:domains');
    return { data: domain };
  }

  async deleteDomain(id: string, user: AuthenticatedUser) {
    const existing = await (this.prisma as any).domain.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, `Domain ${id} not found`);

    await (this.prisma as any).domain.delete({ where: { id } });
    await this.publishEvent(TOPIC_SETTINGS_DOMAIN_UPDATED, { id, code: existing.code, action: 'deleted' }, user);
    await this.cacheInvalidate('aris:settings:domains:*');
    await this.cacheInvalidate('aris:public:domains');
    return { data: { id, deleted: true } };
  }

  // ───────────────────── Public ─────────────────────

  async getPublicRecs() {
    const cacheKey = 'aris:public:recs';
    const cached = await this.cacheGet<{ data: any[] }>(cacheKey);
    if (cached) return cached;

    const recs = await (this.prisma as any).rec.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        fullName: true,
        region: true,
        headquarters: true,
        accentColor: true,
        logoUrl: true,
        website: true,
        sortOrder: true,
        _count: { select: { countries: true } },
      },
    });

    const result = { data: recs };
    await this.cacheSet(cacheKey, result, CACHE_TTL_PUBLIC);
    return result;
  }

  async getPublicRecByCode(code: string) {
    const cacheKey = `aris:public:recs:${code}`;
    const cached = await this.cacheGet<{ data: any }>(cacheKey);
    if (cached) return cached;

    const rec = await (this.prisma as any).rec.findUnique({
      where: { code },
      select: {
        id: true,
        code: true,
        name: true,
        fullName: true,
        description: true,
        region: true,
        headquarters: true,
        established: true,
        accentColor: true,
        isActive: true,
        logoUrl: true,
        website: true,
        stats: true,
        sortOrder: true,
        countries: {
          select: {
            country: {
              select: {
                id: true,
                code: true,
                name: true,
                flag: true,
                capital: true,
                isOperational: true,
              },
            },
          },
          orderBy: { country: { sortOrder: 'asc' } },
        },
        _count: { select: { countries: true } },
      },
    });
    if (!rec) throw new HttpError(404, `REC with code "${code}" not found`);
    if (!rec.isActive) throw new HttpError(404, `REC with code "${code}" not found`);

    const result = { data: rec };
    await this.cacheSet(cacheKey, result, CACHE_TTL_PUBLIC);
    return result;
  }

  async getPublicCountryByCode(code: string) {
    const cacheKey = `aris:public:countries:${code}`;
    const cached = await this.cacheGet<{ data: any }>(cacheKey);
    if (cached) return cached;

    const country = await (this.prisma as any).country.findUnique({
      where: { code },
      select: {
        id: true,
        code: true,
        name: true,
        officialName: true,
        capital: true,
        flag: true,
        population: true,
        area: true,
        timezone: true,
        languages: true,
        currency: true,
        phoneCode: true,
        isOperational: true,
        stats: true,
        sectorPerformance: true,
        recs: {
          select: {
            rec: {
              select: { id: true, code: true, name: true, accentColor: true },
            },
          },
        },
      },
    });
    if (!country) throw new HttpError(404, `Country with code "${code}" not found`);

    const result = { data: country };
    await this.cacheSet(cacheKey, result, CACHE_TTL_PUBLIC);
    return result;
  }

  async getPublicStats() {
    const cacheKey = 'aris:public:stats';
    const cached = await this.cacheGet<{ data: any }>(cacheKey);
    if (cached) return cached;

    const [totalCountries, operationalCountries, totalRecs, populationResult] = await Promise.all([
      (this.prisma as any).country.count({ where: { isActive: true } }),
      (this.prisma as any).country.count({ where: { isActive: true, isOperational: true } }),
      (this.prisma as any).rec.count({ where: { isActive: true } }),
      (this.prisma as any).country.aggregate({
        where: { isActive: true },
        _sum: { population: true },
      }),
    ]);

    // BigInt cannot be JSON-serialized — convert to Number
    const totalPopulation = populationResult._sum.population
      ? Number(populationResult._sum.population)
      : 0;

    const result = {
      data: {
        totalCountries: totalCountries || 55,
        totalRecs: totalRecs || 8,
        operationalCountries,
        totalPopulation,
      },
    };
    await this.cacheSet(cacheKey, result, CACHE_TTL_PUBLIC);
    return result;
  }

  async getPublicDomains() {
    const cacheKey = 'aris:public:domains';
    const cached = await this.cacheGet<{ data: any[] }>(cacheKey);
    if (cached) return cached;

    const domains = await (this.prisma as any).domain.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        icon: true,
        color: true,
        sortOrder: true,
      },
    });

    const result = { data: domains };
    await this.cacheSet(cacheKey, result, CACHE_TTL_PUBLIC);
    return result;
  }

  // ───────────────────── Functions ─────────────────────

  private buildFunctionTenantFilter(caller: AuthenticatedUser): Record<string, unknown> {
    if (!caller.tenantId) {
      throw new HttpError(403, 'Missing tenant context');
    }
    switch (caller.tenantLevel) {
      case 'CONTINENTAL': return {};
      case 'REC': return { tenant: { OR: [{ id: caller.tenantId }, { parentId: caller.tenantId }] } };
      case 'MEMBER_STATE': return { tenantId: caller.tenantId };
      default: return { tenantId: caller.tenantId };
    }
  }

  private async assertFunctionTenantAccess(fn: { tenantId: string }, caller: AuthenticatedUser): Promise<void> {
    if (caller.tenantLevel === 'CONTINENTAL') return;
    if (caller.tenantLevel === 'MEMBER_STATE') {
      if (fn.tenantId !== caller.tenantId) throw new HttpError(403, 'Access denied: function belongs to a different tenant');
      return;
    }
    if (caller.tenantLevel === 'REC') {
      if (fn.tenantId === caller.tenantId) return;
      // Check if the function's tenant is a child of the caller's tenant
      const fnTenant = await (this.prisma as any).tenant.findUnique({
        where: { id: fn.tenantId },
        select: { parentId: true },
      });
      if (fnTenant?.parentId !== caller.tenantId) {
        throw new HttpError(403, 'Access denied: function belongs to a different tenant');
      }
      return;
    }
    throw new HttpError(403, 'Access denied');
  }

  private readonly functionTenantSelect = { id: true, name: true, level: true, countryCode: true };

  async listFunctions(query: {
    page?: number; limit?: number; sort?: string; order?: string;
    search?: string; level?: string; category?: string; status?: string;
  }, user: AuthenticatedUser) {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;
    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'asc' }
      : [{ level: 'asc' as const }, { sortOrder: 'asc' as const }];

    const where: Record<string, unknown> = { ...this.buildFunctionTenantFilter(user) };
    if (query.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.level) where.level = query.level;
    if (query.category) where.category = query.category;
    if (query.status === 'active') where.isActive = true;
    if (query.status === 'inactive') where.isActive = false;

    const scopeTag = user.tenantLevel === 'CONTINENTAL' ? 'all' : user.tenantId;
    const cacheKey = `aris:settings:functions:list:${scopeTag}:${JSON.stringify({ where, skip, limit })}`;
    const cached = await this.cacheGet<{ data: any[]; meta: any }>(cacheKey);
    if (cached) return cached;

    const [data, total] = await Promise.all([
      (this.prisma as any).function.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          _count: { select: { users: true } },
          tenant: { select: this.functionTenantSelect },
        },
      }),
      (this.prisma as any).function.count({ where }),
    ]);

    const result = { data, meta: { total, page, limit } };
    await this.cacheSet(cacheKey, result, CACHE_TTL_LIST);
    return result;
  }

  async getFunctionById(id: string, user: AuthenticatedUser) {
    const cacheKey = `aris:settings:functions:detail:${id}`;
    const cached = await this.cacheGet<{ data: any }>(cacheKey);
    if (cached) {
      await this.assertFunctionTenantAccess(cached.data, user);
      return cached;
    }

    const fn = await (this.prisma as any).function.findUnique({
      where: { id },
      include: {
        _count: { select: { users: true } },
        tenant: { select: this.functionTenantSelect },
        users: {
          include: {
            user: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
          },
          take: 20,
          orderBy: { isPrimary: 'desc' },
        },
      },
    });
    if (!fn) throw new HttpError(404, `Function ${id} not found`);

    await this.assertFunctionTenantAccess(fn, user);

    const result = { data: fn };
    await this.cacheSet(cacheKey, result, CACHE_TTL_DETAIL);
    return result;
  }

  async createFunction(dto: Record<string, unknown>, user: AuthenticatedUser) {
    // Determine tenantId: continental admins can optionally specify; others use their own
    let tenantId: string;
    if (user.tenantLevel === 'CONTINENTAL' && dto.tenantId) {
      tenantId = dto.tenantId as string;
    } else {
      tenantId = user.tenantId;
    }

    const existing = await (this.prisma as any).function.findFirst({
      where: { code: dto.code as string, level: dto.level as string, tenantId },
    });
    if (existing) throw new HttpError(409, `Function "${dto.code}" at level "${dto.level}" already exists for this tenant`);

    const fn = await (this.prisma as any).function.create({
      data: {
        code: dto.code as string,
        name: (dto.name ?? {}) as Prisma.InputJsonValue,
        description: (dto.description ?? null) as Prisma.InputJsonValue,
        level: dto.level as string,
        category: (dto.category as string) ?? null,
        permissions: (dto.permissions ?? null) as Prisma.InputJsonValue,
        isActive: (dto.isActive as boolean) ?? true,
        isDefault: (dto.isDefault as boolean) ?? false,
        sortOrder: (dto.sortOrder as number) ?? 0,
        metadata: (dto.metadata ?? null) as Prisma.InputJsonValue,
        tenantId,
      },
      include: { tenant: { select: this.functionTenantSelect } },
    });

    await this.publishEvent(TOPIC_SETTINGS_FUNCTION_UPDATED, { ...fn, action: 'created' }, user);
    await this.invalidateFunctionCache();
    return { data: fn };
  }

  async updateFunction(id: string, dto: Record<string, unknown>, user: AuthenticatedUser) {
    const existing = await (this.prisma as any).function.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, `Function ${id} not found`);

    await this.assertFunctionTenantAccess(existing, user);

    const updateData: Record<string, unknown> = {};
    if (dto.name !== undefined) updateData.name = dto.name as Prisma.InputJsonValue;
    if (dto.description !== undefined) updateData.description = dto.description as Prisma.InputJsonValue;
    if (dto.category !== undefined) updateData.category = dto.category;
    if (dto.permissions !== undefined) updateData.permissions = dto.permissions as Prisma.InputJsonValue;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.isDefault !== undefined) updateData.isDefault = dto.isDefault;
    if (dto.sortOrder !== undefined) updateData.sortOrder = dto.sortOrder;
    if (dto.metadata !== undefined) updateData.metadata = dto.metadata as Prisma.InputJsonValue;

    try {
      const fn = await (this.prisma as any).function.update({
        where: { id },
        data: updateData,
        include: { tenant: { select: this.functionTenantSelect } },
      });
      await this.publishEvent(TOPIC_SETTINGS_FUNCTION_UPDATED, { ...fn, action: 'updated' }, user);
      await this.invalidateFunctionCache();
      return { data: fn };
    } catch (err: any) {
      if (err.code === 'P2025') throw new HttpError(404, `Function ${id} not found`);
      throw err;
    }
  }

  async deleteFunction(id: string, user: AuthenticatedUser) {
    const existing = await (this.prisma as any).function.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!existing) throw new HttpError(404, `Function ${id} not found`);

    await this.assertFunctionTenantAccess(existing, user);

    if (existing._count.users > 0) {
      throw new HttpError(409, `Cannot delete function with ${existing._count.users} assigned users`);
    }

    await (this.prisma as any).function.delete({ where: { id } });
    await this.publishEvent(TOPIC_SETTINGS_FUNCTION_UPDATED, { id, action: 'deleted' }, user);
    await this.invalidateFunctionCache();
    return { data: { id, deleted: true } };
  }

  // ───────────────────── User-Function Assignment ─────────────────────

  async assignUserFunction(userId: string, functionId: string, isPrimary: boolean, notes: string | null, user: AuthenticatedUser) {
    const targetUser = await (this.prisma as any).user.findUnique({ where: { id: userId } });
    if (!targetUser) throw new HttpError(404, `User ${userId} not found`);

    const fn = await (this.prisma as any).function.findUnique({ where: { id: functionId } });
    if (!fn) throw new HttpError(404, `Function ${functionId} not found`);

    // If setting as primary, remove primary from other assignments
    if (isPrimary) {
      await (this.prisma as any).userFunction.updateMany({
        where: { userId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const assignment = await (this.prisma as any).userFunction.upsert({
      where: { userId_functionId: { userId, functionId } },
      update: { isPrimary, notes, assignedBy: user.userId },
      create: { userId, functionId, isPrimary, notes, assignedBy: user.userId },
      include: {
        function: { select: { id: true, code: true, name: true, level: true, category: true } },
      },
    });

    await this.publishEvent(TOPIC_SETTINGS_USER_UPDATED, {
      userId,
      functionId,
      action: 'function_assigned',
    }, user);
    await this.invalidateUserCache();
    return { data: assignment };
  }

  async removeUserFunction(userId: string, functionId: string, user: AuthenticatedUser) {
    const existing = await (this.prisma as any).userFunction.findUnique({
      where: { userId_functionId: { userId, functionId } },
    });
    if (!existing) throw new HttpError(404, 'User-function assignment not found');

    await (this.prisma as any).userFunction.delete({
      where: { userId_functionId: { userId, functionId } },
    });

    await this.publishEvent(TOPIC_SETTINGS_USER_UPDATED, {
      userId,
      functionId,
      action: 'function_removed',
    }, user);
    await this.invalidateUserCache();
    return { data: { userId, functionId, deleted: true } };
  }

  async getUserFunctions(userId: string) {
    const assignments = await (this.prisma as any).userFunction.findMany({
      where: { userId },
      include: {
        function: { select: { id: true, code: true, name: true, level: true, category: true, isActive: true } },
      },
      orderBy: [{ isPrimary: 'desc' }, { startDate: 'asc' }],
    });
    return { data: assignments };
  }

  // ───────────────────── Users Management ─────────────────────

  private buildUserTenantFilter(caller: AuthenticatedUser): Record<string, unknown> {
    switch (caller.tenantLevel) {
      case 'CONTINENTAL': return {};
      case 'REC': return { tenant: { OR: [{ id: caller.tenantId }, { parentId: caller.tenantId }] } };
      case 'MEMBER_STATE': return { tenantId: caller.tenantId };
      default: return { tenantId: caller.tenantId };
    }
  }

  async listUsers(query: {
    page?: number; limit?: number; sort?: string; order?: string;
    search?: string; role?: string; status?: string;
    tenantId?: string; functionId?: string;
  }, caller: AuthenticatedUser) {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;
    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'asc' }
      : { createdAt: 'desc' as const };

    const where: Record<string, unknown> = { ...this.buildUserTenantFilter(caller) };
    if (query.search) {
      where.OR = [
        { email: { contains: query.search, mode: 'insensitive' } },
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.role) where.role = query.role;
    if (query.status === 'active') where.isActive = true;
    if (query.status === 'inactive') where.isActive = false;
    if (query.tenantId) where.tenantId = query.tenantId;
    if (query.functionId) {
      where.functions = { some: { functionId: query.functionId } };
    }

    const [data, total] = await Promise.all([
      (this.prisma as any).user.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: {
          id: true, email: true, firstName: true, lastName: true,
          role: true, locale: true, mfaEnabled: true, isActive: true,
          lastLoginAt: true, createdAt: true, updatedAt: true,
          tenantId: true,
          tenant: { select: { id: true, name: true, level: true, countryCode: true, recCode: true } },
          functions: {
            include: {
              function: { select: { id: true, code: true, name: true, level: true, category: true } },
            },
            orderBy: { isPrimary: 'desc' },
          },
        },
      }),
      (this.prisma as any).user.count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  async getUserById(id: string, caller: AuthenticatedUser) {
    const user = await (this.prisma as any).user.findUnique({
      where: { id },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, locale: true, mfaEnabled: true, isActive: true,
        lastLoginAt: true, createdAt: true, updatedAt: true,
        tenantId: true,
        tenant: { select: { id: true, name: true, level: true, countryCode: true, recCode: true } },
        functions: {
          include: {
            function: { select: { id: true, code: true, name: true, level: true, category: true } },
          },
          orderBy: { isPrimary: 'desc' },
        },
      },
    });
    if (!user) throw new HttpError(404, `User ${id} not found`);

    // Access check
    if (caller.tenantLevel === 'MEMBER_STATE' && user.tenantId !== caller.tenantId) {
      throw new HttpError(403, 'Access denied');
    }

    return { data: user };
  }

  async createUser(dto: Record<string, unknown>, caller: AuthenticatedUser) {
    const email = dto.email as string;
    const existing = await (this.prisma as any).user.findUnique({ where: { email } });
    if (existing) throw new HttpError(409, `User with email "${email}" already exists`);

    const passwordHash = await hash(dto.password as string, BCRYPT_ROUNDS);

    const user = await (this.prisma as any).user.create({
      data: {
        email,
        passwordHash,
        firstName: dto.firstName as string,
        lastName: dto.lastName as string,
        role: dto.role as string,
        tenantId: dto.tenantId as string,
        locale: (dto.locale as string) ?? 'en',
      },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, locale: true, isActive: true, tenantId: true, createdAt: true,
      },
    });

    // Assign functions if provided
    const functionIds = dto.functionIds as string[] | undefined;
    if (functionIds && functionIds.length > 0) {
      await (this.prisma as any).userFunction.createMany({
        data: functionIds.map((fId, idx) => ({
          userId: user.id,
          functionId: fId,
          isPrimary: idx === 0,
          assignedBy: caller.userId,
        })),
        skipDuplicates: true,
      });
    }

    await this.publishEvent(TOPIC_SETTINGS_USER_UPDATED, { ...user, action: 'created' }, caller);
    await this.invalidateUserCache();
    return { data: user };
  }

  async updateUser(id: string, dto: Record<string, unknown>, caller: AuthenticatedUser) {
    const existing = await (this.prisma as any).user.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, `User ${id} not found`);

    // Only SUPER_ADMIN can change roles
    if (dto.role !== undefined && dto.role !== existing.role) {
      if (caller.role !== 'SUPER_ADMIN') throw new HttpError(403, 'Only SUPER_ADMIN can change user roles');
    }

    const updateData: Record<string, unknown> = {};
    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.firstName !== undefined) updateData.firstName = dto.firstName;
    if (dto.lastName !== undefined) updateData.lastName = dto.lastName;
    if (dto.role !== undefined) updateData.role = dto.role;
    if (dto.locale !== undefined) updateData.locale = dto.locale;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    const user = await (this.prisma as any).user.update({
      where: { id },
      data: updateData,
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, locale: true, isActive: true, tenantId: true, updatedAt: true,
      },
    });

    await this.publishEvent(TOPIC_SETTINGS_USER_UPDATED, { ...user, action: 'updated' }, caller);
    await this.invalidateUserCache();
    return { data: user };
  }

  async resetUserPassword(id: string, password: string, caller: AuthenticatedUser) {
    const existing = await (this.prisma as any).user.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, `User ${id} not found`);

    const passwordHash = await hash(password, BCRYPT_ROUNDS);
    await (this.prisma as any).user.update({
      where: { id },
      data: { passwordHash },
    });

    await this.publishEvent(TOPIC_SETTINGS_USER_UPDATED, { userId: id, action: 'password_reset' }, caller);
    return { data: { id, passwordReset: true } };
  }

  async deleteUser(id: string, caller: AuthenticatedUser) {
    const existing = await (this.prisma as any).user.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, `User ${id} not found`);

    // Prevent deleting yourself
    if (id === caller.userId) throw new HttpError(400, 'Cannot delete your own account');

    await (this.prisma as any).user.delete({ where: { id } });
    await this.publishEvent(TOPIC_SETTINGS_USER_UPDATED, { id, action: 'deleted' }, caller);
    await this.invalidateUserCache();
    return { data: { id, deleted: true } };
  }

  // ───────────────────── Cache invalidation helpers ─────────────────────

  private async invalidateFunctionCache(): Promise<void> {
    await this.cacheInvalidate('aris:settings:functions:*');
  }

  private async invalidateUserCache(): Promise<void> {
    await this.cacheInvalidate('aris:settings:users:*');
  }

  private async invalidateRecCache(): Promise<void> {
    await Promise.all([
      this.cacheInvalidate('aris:settings:recs:*'),
      this.cacheInvalidate('aris:public:recs*'),
      this.cacheInvalidate('aris:public:stats'),
      this.cacheInvalidate('aris:scope:*'),
    ]);
  }

  private async invalidateCountryCache(): Promise<void> {
    await Promise.all([
      this.cacheInvalidate('aris:settings:countries:*'),
      this.cacheInvalidate('aris:public:countries:*'),
      this.cacheInvalidate('aris:public:stats'),
      this.cacheInvalidate('aris:scope:*'),
    ]);
  }

  // ───────────────────── Private helpers ─────────────────────

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
      await this.kafka.send(topic, key, payload, headers);
    } catch {
      // Kafka publish failures are non-blocking
    }
  }
}

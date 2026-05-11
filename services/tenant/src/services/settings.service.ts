import { randomUUID } from 'crypto';
import { hash } from 'bcrypt';
import type { PrismaClient, Prisma } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import type Redis from 'ioredis';
import {
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  TOPIC_SYS_CREDENTIAL_USER_CREATED,
} from '@aris/shared-types';
import type { KafkaHeaders } from '@aris/shared-types';

const SERVICE_NAME = 'tenant-service';

const TOPIC_SETTINGS_REC_UPDATED = 'sys.settings.rec.updated.v1';
const TOPIC_SETTINGS_COUNTRY_UPDATED = 'sys.settings.country.updated.v1';
const TOPIC_SETTINGS_CONFIG_UPDATED = 'sys.settings.config.updated.v1';
const TOPIC_SETTINGS_DOMAIN_UPDATED = 'sys.settings.domain.updated.v1';
const TOPIC_SETTINGS_FUNCTION_UPDATED = 'sys.settings.function.updated.v1';
const TOPIC_SETTINGS_USER_UPDATED = 'sys.settings.user.updated.v1';
const TOPIC_SETTINGS_STAT_DEF_UPDATED = 'sys.settings.statistic-definition.updated.v1';
const TOPIC_SETTINGS_KPI_DEF_UPDATED = 'sys.settings.kpi-definition.updated.v1';
const TOPIC_SETTINGS_COUNTRY_STAT_UPDATED = 'sys.settings.country-statistic.updated.v1';
const TOPIC_SETTINGS_COUNTRY_KPI_UPDATED = 'sys.settings.country-kpi-score.updated.v1';

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
  /**
   * Assert that the caller can write to a specific REC.
   * CONTINENTAL → all RECs; REC → only own REC; others → denied.
   */
  private async assertRecWriteAccess(recId: string, user: AuthenticatedUser): Promise<void> {
    if (user.tenantLevel === 'CONTINENTAL') return;
    if (user.tenantLevel === 'REC') {
      const rec = await (this.prisma as any).rec.findUnique({ where: { id: recId }, select: { code: true } });
      if (!rec) throw new HttpError(404, `REC ${recId} not found`);
      const scope = await this.getUserScope(user);
      if (scope.recCodes.includes(rec.code)) return;
    }
    throw new HttpError(403, 'Access denied: you can only modify your own REC');
  }

  /**
   * Assert that the caller can write to a specific country.
   * CONTINENTAL → all; REC → countries in own REC; NATIONAL → own country only.
   */
  private async assertCountryWriteAccess(countryId: string, user: AuthenticatedUser): Promise<void> {
    if (user.tenantLevel === 'CONTINENTAL') return;
    const country = await (this.prisma as any).country.findUnique({ where: { id: countryId }, select: { code: true } });
    if (!country) throw new HttpError(404, `Country ${countryId} not found`);
    const scope = await this.getUserScope(user);
    if (scope.countryCodes.includes(country.code)) return;
    throw new HttpError(403, 'Access denied: country is outside your scope');
  }

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
      // REC-level: find all countries in this REC (case-insensitive match)
      const links = await (this.prisma as any).countryRec.findMany({
        where: { rec: { code: { equals: tenant.recCode, mode: 'insensitive' } } },
        select: { country: { select: { code: true } } },
      });
      const countryCodes = links.map((l: any) => l.country.code as string);
      scope = { all: false, recCodes: [tenant.recCode.toLowerCase()], countryCodes };
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
        currency: (dto.currency as string) ?? null,
        isActive: (dto.isActive as boolean) ?? true,
        sortOrder: (dto.sortOrder as number) ?? 0,
        stats: (dto.stats ?? {}) as Prisma.InputJsonValue,
        metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });

    await this.publishEvent(TOPIC_SETTINGS_REC_UPDATED, { ...rec, action: 'created' }, user);
    await this.writeAudit('rec', rec.id, 'CREATE', user, { newVersion: { code: dto.code }, classification: 'PUBLIC' });
    await this.invalidateRecCache();
    return { data: rec };
  }

  async updateRec(id: string, dto: Record<string, unknown>, user: AuthenticatedUser) {
    // Scope check: REC_ADMIN can only update their own REC
    await this.assertRecWriteAccess(id, user);

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
    if (dto.currency !== undefined) updateData.currency = dto.currency;
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
      await this.writeAudit('rec', id, 'UPDATE', user, { newVersion: updateData, classification: 'PUBLIC' });
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
    await this.writeAudit('rec', id, 'DELETE', user, { previousVersion: { code: existing.code }, classification: 'PUBLIC' });
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
    await this.assertRecWriteAccess(id, user);
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
        isActive: (dto.isActive as boolean) ?? false,
        isOperational: (dto.isOperational as boolean) ?? false,
        tenantId: (dto.tenantId as string) ?? null,
        sortOrder: (dto.sortOrder as number) ?? 0,
        stats: (dto.stats ?? {}) as Prisma.InputJsonValue,
        sectorPerformance: (dto.sectorPerformance ?? {}) as Prisma.InputJsonValue,
        welcomeMessage: (dto.welcomeMessage as string) ?? null,
        metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });

    await this.publishEvent(TOPIC_SETTINGS_COUNTRY_UPDATED, { ...country, action: 'created' }, user);
    await this.writeAudit('country', country.id, 'CREATE', user, { newVersion: { code: dto.code }, classification: 'PUBLIC' });
    await this.invalidateCountryCache();
    return { data: country };
  }

  async updateCountry(id: string, dto: Record<string, unknown>, user: AuthenticatedUser) {
    await this.assertCountryWriteAccess(id, user);
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
    if (dto.welcomeMessage !== undefined) updateData.welcomeMessage = dto.welcomeMessage;
    if (dto.metadata !== undefined) updateData.metadata = dto.metadata as Prisma.InputJsonValue;

    try {
      const country = await (this.prisma as any).country.update({
        where: { id },
        data: updateData,
      });
      await this.publishEvent(TOPIC_SETTINGS_COUNTRY_UPDATED, { ...country, action: 'updated' }, user);
      await this.writeAudit('country', id, 'UPDATE', user, { newVersion: updateData, classification: 'PUBLIC' });
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
      await this.writeAudit('country', id, 'DELETE', user, { classification: 'PUBLIC' });
      await this.invalidateCountryCache();
      return { data: { id, deleted: true } };
    } catch (err: any) {
      if (err.code === 'P2025') throw new HttpError(404, `Country ${id} not found`);
      throw err;
    }
  }

  async updateCountryStats(id: string, stats: Record<string, unknown>, user: AuthenticatedUser) {
    await this.assertCountryWriteAccess(id, user);
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
    await this.assertCountryWriteAccess(id, user);
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
        label: { en: key },
        type: 'json',
        updatedBy: user.userId,
      },
    });

    await this.publishEvent(TOPIC_SETTINGS_CONFIG_UPDATED, { category, key, value, action: 'updated' }, user);
    await this.writeAudit('config', randomUUID(), 'UPDATE', user, { newVersion: { category, key }, classification: 'RESTRICTED' });
    await this.cacheInvalidate('aris:settings:config:*');
    if (category === 'i18n') await this.cacheInvalidate('aris:public:i18n');
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
            label: { en: c.key },
            type: 'json',
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
    if (configs.some((c) => c.category === 'i18n')) await this.cacheInvalidate('aris:public:i18n');
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
    await this.writeAudit('domain', domain.id, 'CREATE', user, { newVersion: { code: dto.code }, classification: 'PUBLIC' });
    await this.cacheInvalidate('aris:settings:domains:*');
    await this.cacheInvalidate('aris:public:domains');
    return { data: domain };
  }

  async deleteDomain(id: string, user: AuthenticatedUser) {
    const existing = await (this.prisma as any).domain.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, `Domain ${id} not found`);

    await (this.prisma as any).domain.delete({ where: { id } });
    await this.publishEvent(TOPIC_SETTINGS_DOMAIN_UPDATED, { id, code: existing.code, action: 'deleted' }, user);
    await this.writeAudit('domain', id, 'DELETE', user, { previousVersion: { code: existing.code }, classification: 'PUBLIC' });
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

    // Count countries actively notifying this year (submitted data in any domain)
    let activeCount = 0;
    try {
      const rows: any[] = await (this.prisma as any).$queryRawUnsafe(`
        SELECT COUNT(DISTINCT c.id)::int AS cnt
        FROM governance.country_recs cr
        JOIN governance.countries c ON c.id = cr.country_id
        JOIN governance.recs r ON r.id = cr.rec_id
        WHERE r.code = $1
          AND c.tenant_id IS NOT NULL
          AND (
            EXISTS (
              SELECT 1 FROM public.submissions s
              WHERE s.tenant_id = c.tenant_id
                AND s.status != 'DRAFT'
                AND s.submitted_at >= date_trunc('year', now())
            )
            OR EXISTS (
              SELECT 1 FROM form_builder.form_submissions fs
              WHERE fs.tenant_id = c.tenant_id
                AND fs.status != 'DRAFT'
                AND fs.submitted_at >= date_trunc('year', now())
            )
          )
      `, code);
      activeCount = rows[0]?.cnt ?? 0;
    } catch {
      // Tables may not have data yet — default to 0
    }

    // Count countries with active interoperability (ETL connection or WAHIS export this year)
    let interopCount = 0;
    try {
      const rows: any[] = await (this.prisma as any).$queryRawUnsafe(`
        SELECT COUNT(DISTINCT c.id)::int AS cnt
        FROM governance.country_recs cr
        JOIN governance.countries c ON c.id = cr.country_id
        JOIN governance.recs r ON r.id = cr.rec_id
        WHERE r.code = $1
          AND (
            EXISTS (
              SELECT 1 FROM interop_v2.interop_connections ic
              WHERE ic.tenant_id = c.tenant_id AND ic.is_active = true
            )
            OR EXISTS (
              SELECT 1 FROM interop_hub.export_records er
              WHERE er.tenant_id = c.tenant_id
                AND er.status = 'COMPLETED'
                AND er.created_at >= date_trunc('year', now())
            )
          )
      `, code);
      interopCount = rows[0]?.cnt ?? 0;
    } catch {
      // Interop schemas may not have data yet — default to 0
    }

    const result = { data: { ...rec, activeCount, interopCount } };
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
        isActive: true,
        isOperational: true,
        tenantId: true,
        stats: true,
        sectorPerformance: true,
        welcomeMessage: true,
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

    // Fetch configured statistics (visible only, with definitions)
    let statistics: any[] = [];
    try {
      const countryStats = await (this.prisma as any).countryStatistic.findMany({
        where: { countryId: country.id, isVisible: true },
        include: { statistic: true },
        orderBy: { sortOrder: 'asc' },
      });
      statistics = countryStats.map((cs: any) => ({
        code: cs.statistic.code,
        name: cs.statistic.name,
        domain: cs.statistic.domainCode,
        icon: cs.statistic.icon,
        color: cs.statistic.color,
        value: cs.overrideValue ?? 0,
        unit: cs.statistic.unit,
        format: cs.statistic.format,
        period: cs.displayPeriod,
      }));
    } catch {
      // Tables may not exist yet
    }

    // Fetch KPI scores (current year, with definitions)
    let kpiScores: any[] = [];
    try {
      const currentYear = new Date().getFullYear();
      const scores = await (this.prisma as any).countryKpiScore.findMany({
        where: { countryId: country.id, year: currentYear },
        include: { kpi: true },
        orderBy: { kpi: { sortOrder: 'asc' } },
      });
      kpiScores = scores.map((s: any) => {
        const status = s.score >= s.kpi.thresholdGood ? 'good'
          : s.score >= s.kpi.thresholdWarn ? 'warning'
          : 'alert';
        const statusLabel = status === 'good' ? 'Strong'
          : status === 'warning' ? 'Moderate'
          : 'Needs Attention';
        return {
          code: s.kpi.code,
          name: s.kpi.name,
          domain: s.kpi.domainCode,
          icon: s.kpi.icon,
          color: s.kpi.color,
          score: s.score,
          target: s.kpi.targetValue,
          unit: s.kpi.unit,
          status,
          statusLabel,
        };
      });
    } catch {
      // Tables may not exist yet
    }

    // Determine interop status
    let hasInterop = false;
    if (country.tenantId) {
      try {
        const rows: any[] = await (this.prisma as any).$queryRawUnsafe(`
          SELECT EXISTS (
            SELECT 1 FROM interop_v2.interop_connections ic
            WHERE ic.tenant_id = $1::uuid AND ic.is_active = true
          ) OR EXISTS (
            SELECT 1 FROM interop_hub.export_records er
            WHERE er.tenant_id = $1::uuid
              AND er.status = 'COMPLETED'
              AND er.created_at >= date_trunc('year', now())
          ) AS has_interop
        `, country.tenantId);
        hasInterop = rows[0]?.has_interop ?? false;
      } catch {
        // Interop schemas may not exist
      }
    }

    const result = {
      data: {
        ...country,
        statistics,
        kpiScores,
        hasInterop,
      },
    };
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

  async getPublicPlatformConfig() {
    const cacheKey = 'aris:public:platform';
    const cached = await this.cacheGet<{ data: any }>(cacheKey);
    if (cached) return cached;

    const configs = await (this.prisma as any).systemConfig.findMany({
      where: { category: 'general' },
      select: { key: true, value: true },
    });

    const map: Record<string, unknown> = {};
    for (const c of configs) map[c.key] = c.value;

    const result = {
      data: {
        name: (map['platform.name'] as string) ?? 'ARIS',
        fullName: map['platform.fullName'] ?? { en: 'Animal Resources Information System' },
        logoUrl: (map['platform.logo.url'] as string) ?? '/au-logo.png',
      },
    };
    await this.cacheSet(cacheKey, result, CACHE_TTL_PUBLIC);
    return result;
  }

  async getPublicI18nConfig() {
    const cacheKey = 'aris:public:i18n';
    const cached = await this.cacheGet<{ data: any }>(cacheKey);
    if (cached) return cached;

    const configs = await (this.prisma as any).systemConfig.findMany({
      where: { category: 'i18n' },
      select: { key: true, value: true },
    });

    const map: Record<string, unknown> = {};
    for (const c of configs) map[c.key] = c.value;

    const result = {
      data: {
        availableLocales: map['i18n.availableLocales'] ?? ['en', 'fr', 'pt', 'ar', 'es'],
        defaultLocale: map['i18n.defaultLocale'] ?? 'en',
        autoDetect: (map['i18n.autoDetect'] as boolean) ?? false,
      },
    };
    await this.cacheSet(cacheKey, result, CACHE_TTL_PUBLIC);
    return result;
  }

  // ───────────────────── Functions ─────────────────────

  private async buildFunctionTenantFilter(caller: AuthenticatedUser): Promise<Record<string, unknown>> {
    if (!caller.tenantId) {
      throw new HttpError(403, 'Missing tenant context');
    }
    switch (caller.tenantLevel) {
      case 'CONTINENTAL': return {};
      case 'REC':
        return {
          OR: [
            { tenant: { level: 'CONTINENTAL' } },          // continental functions
            { tenantId: caller.tenantId },                  // own REC functions
            { tenant: { parentId: caller.tenantId } },      // child country functions
          ],
        };
      case 'MEMBER_STATE': {
        // Resolve parent REC tenant so national admins see continental + REC + own functions
        const myTenant = await (this.prisma as any).tenant.findUnique({
          where: { id: caller.tenantId },
          select: { parentId: true },
        });
        const parentIds: string[] = [];
        if (myTenant?.parentId) parentIds.push(myTenant.parentId);
        return {
          OR: [
            { tenant: { level: 'CONTINENTAL' } },          // continental functions
            ...(parentIds.length ? [{ tenantId: { in: parentIds } }] : []), // parent REC functions
            { tenantId: caller.tenantId },                  // own national functions
          ],
        };
      }
      default: return { tenantId: caller.tenantId };
    }
  }

  private async assertFunctionTenantAccess(fn: { tenantId: string }, caller: AuthenticatedUser, mode: 'read' | 'write' = 'write'): Promise<void> {
    if (caller.tenantLevel === 'CONTINENTAL') return;
    if (caller.tenantLevel === 'MEMBER_STATE') {
      if (fn.tenantId === caller.tenantId) return; // own function
      if (mode === 'read') {
        // National admins can read continental + parent REC functions
        const fnTenant = await (this.prisma as any).tenant.findUnique({
          where: { id: fn.tenantId },
          select: { level: true, id: true },
        });
        if (fnTenant?.level === 'CONTINENTAL') return;
        // Check if fn belongs to parent REC
        const myTenant = await (this.prisma as any).tenant.findUnique({
          where: { id: caller.tenantId },
          select: { parentId: true },
        });
        if (myTenant?.parentId && fn.tenantId === myTenant.parentId) return;
      }
      throw new HttpError(403, 'Access denied: function belongs to a different tenant');
    }
    if (caller.tenantLevel === 'REC') {
      if (fn.tenantId === caller.tenantId) return;
      if (mode === 'read') {
        // REC admins can read continental functions
        const fnTenant = await (this.prisma as any).tenant.findUnique({
          where: { id: fn.tenantId },
          select: { level: true },
        });
        if (fnTenant?.level === 'CONTINENTAL') return;
      }
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

    const where: Record<string, unknown> = { ...(await this.buildFunctionTenantFilter(user)) };
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
          roles: { include: { role: { select: { id: true, code: true, name: true, color: true, icon: true } } } },
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
        roles: { include: { role: { select: { id: true, code: true, name: true, color: true, icon: true } } } },
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
      include: {
        tenant: { select: this.functionTenantSelect },
        roles: { include: { role: { select: { id: true, code: true, name: true, color: true, icon: true } } } },
      },
    });

    // Assign roles if provided
    if (Array.isArray(dto.roleIds) && (dto.roleIds as string[]).length > 0) {
      const roleIds = dto.roleIds as string[];
      await (this.prisma as any).functionRole.createMany({
        data: roleIds.map((roleId: string) => ({ functionId: fn.id, roleId })),
        skipDuplicates: true,
      });
    }

    await this.publishEvent(TOPIC_SETTINGS_FUNCTION_UPDATED, { ...fn, action: 'created' }, user);
    await this.writeAudit('function', fn.id, 'CREATE', user, { newVersion: { code: dto.code }, classification: 'PUBLIC' });
    await this.invalidateFunctionCache();

    // Re-fetch with roles included
    if (Array.isArray(dto.roleIds) && (dto.roleIds as string[]).length > 0) {
      const refreshed = await (this.prisma as any).function.findUnique({
        where: { id: fn.id },
        include: {
          tenant: { select: this.functionTenantSelect },
          roles: { include: { role: { select: { id: true, code: true, name: true, color: true, icon: true } } } },
        },
      });
      return { data: refreshed };
    }

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

    // Handle roleIds update: replace all FunctionRole records
    if (Array.isArray(dto.roleIds)) {
      const roleIds = dto.roleIds as string[];
      await (this.prisma as any).functionRole.deleteMany({ where: { functionId: id } });
      if (roleIds.length > 0) {
        await (this.prisma as any).functionRole.createMany({
          data: roleIds.map((roleId: string) => ({ functionId: id, roleId })),
          skipDuplicates: true,
        });
      }
    }

    try {
      const fn = await (this.prisma as any).function.update({
        where: { id },
        data: updateData,
        include: {
          tenant: { select: this.functionTenantSelect },
          roles: { include: { role: { select: { id: true, code: true, name: true, color: true, icon: true } } } },
        },
      });
      await this.publishEvent(TOPIC_SETTINGS_FUNCTION_UPDATED, { ...fn, action: 'updated' }, user);
      await this.writeAudit('function', id, 'UPDATE', user, { newVersion: updateData, classification: 'PUBLIC' });
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
    await this.writeAudit('function', id, 'DELETE', user, { previousVersion: { code: existing.code }, classification: 'PUBLIC' });
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

  /**
   * Assert that the caller can access/modify a user in the given tenant.
   * CONTINENTAL → all; REC → own REC + child countries; MEMBER_STATE → own tenant only.
   */
  private async assertUserAccess(caller: AuthenticatedUser, targetTenantId: string): Promise<void> {
    if (caller.tenantLevel === 'CONTINENTAL') return;
    if (caller.tenantId === targetTenantId) return;
    if (caller.tenantLevel === 'REC') {
      const target = await (this.prisma as any).tenant.findUnique({
        where: { id: targetTenantId },
        select: { parentId: true },
      });
      if (target?.parentId === caller.tenantId) return;
    }
    throw new HttpError(403, 'Access denied: user is outside your scope');
  }

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
          id: true, email: true, firstName: true, lastName: true, phone: true,
          role: true, locale: true, mfaEnabled: true, isActive: true,
          lastLoginAt: true, createdAt: true, updatedAt: true,
          tenantId: true,
          tenant: { select: { id: true, name: true, level: true, countryCode: true, recCode: true } },
          functions: {
            include: {
              function: {
                select: {
                  id: true, code: true, name: true, level: true, category: true,
                  roles: { include: { role: { select: { id: true, code: true, name: true, color: true } } } },
                },
              },
            },
            orderBy: { isPrimary: 'desc' },
          },
          userDomains: {
            where: { isActive: true },
            include: { domain: { select: { id: true, code: true, name: true, icon: true, color: true } } },
            orderBy: { domain: { sortOrder: 'asc' as const } },
          },
          roleAssignments: {
            include: { role: { select: { id: true, code: true, name: true, color: true } } },
          },
        },
      }),
      (this.prisma as any).user.count({ where }),
    ]);

    // Transform userDomains to domains
    const transformed = data.map((u: any) => {
      const { userDomains, ...rest } = u;
      return { ...rest, domains: userDomains?.map((ud: any) => ud.domain) ?? [] };
    });

    return { data: transformed, meta: { total, page, limit } };
  }

  async getUserById(id: string, caller: AuthenticatedUser) {
    const raw = await (this.prisma as any).user.findUnique({
      where: { id },
      select: {
        id: true, email: true, firstName: true, lastName: true, phone: true,
        role: true, locale: true, mfaEnabled: true, isActive: true,
        lastLoginAt: true, createdAt: true, updatedAt: true,
        tenantId: true,
        tenant: { select: { id: true, name: true, level: true, countryCode: true, recCode: true } },
        functions: {
          include: {
            function: {
              select: {
                id: true, code: true, name: true, level: true, category: true,
                roles: { include: { role: { select: { id: true, code: true, name: true, color: true } } } },
              },
            },
          },
          orderBy: { isPrimary: 'desc' },
        },
        userDomains: {
          where: { isActive: true },
          include: { domain: { select: { id: true, code: true, name: true, icon: true, color: true } } },
          orderBy: { domain: { sortOrder: 'asc' as const } },
        },
        roleAssignments: {
          include: { role: { select: { id: true, code: true, name: true, color: true } } },
        },
      },
    });
    if (!raw) throw new HttpError(404, `User ${id} not found`);

    // Access check — enforce tenant scope
    await this.assertUserAccess(caller, raw.tenantId);

    const { userDomains, ...rest } = raw;
    const user = { ...rest, domains: userDomains?.map((ud: any) => ud.domain) ?? [] };

    return { data: user };
  }

  async createUser(dto: Record<string, unknown>, caller: AuthenticatedUser) {
    const email = dto.email as string;
    const existing = await (this.prisma as any).user.findUnique({ where: { email } });
    if (existing) throw new HttpError(409, `User with email "${email}" already exists`);

    const plainPassword = dto.password as string;
    const passwordHash = await hash(plainPassword, BCRYPT_ROUNDS);

    const user = await (this.prisma as any).user.create({
      data: {
        email,
        passwordHash,
        firstName: dto.firstName as string,
        lastName: dto.lastName as string,
        phone: (dto.phone as string) ?? null,
        role: dto.role as string,
        tenantId: dto.tenantId as string,
        locale: (dto.locale as string) ?? 'en',
        // Admin-created users receive a temporary password; ForcePasswordChangeModal
        // will block the UI on first login until they pick a new one.
        mustChangePassword: true,
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

    // Assign direct roles if provided
    const directRoleIds = dto.directRoleIds as string[] | undefined;
    if (directRoleIds && directRoleIds.length > 0) {
      await (this.prisma as any).userRoleAssignment.createMany({
        data: directRoleIds.map((roleId) => ({
          userId: user.id,
          roleId,
          source: 'direct',
          assignedBy: caller.userId,
        })),
        skipDuplicates: true,
      });
    }

    // Assign domains if provided
    const domainIds = dto.domainIds as string[] | undefined;
    if (domainIds && domainIds.length > 0) {
      await (this.prisma as any).userDomain.createMany({
        data: domainIds.map((domainId) => ({
          userId: user.id,
          domainId,
          assignedBy: caller.userId,
        })),
        skipDuplicates: true,
      });
    }

    await this.publishEvent(TOPIC_SETTINGS_USER_UPDATED, { ...user, action: 'created' }, caller);
    await this.writeAudit('user', user.id, 'CREATE', caller, { newVersion: user, classification: 'RESTRICTED' });

    // Also publish the canonical credential-user-created event so the
    // welcome-email consumer in the message service delivers the
    // temporary-password email. The plain-text password only travels on
    // this single Kafka message — it is never persisted outside bcrypt.
    try {
      const tenant = await (this.prisma as any).tenant.findUnique({
        where: { id: user.tenantId },
        select: { name: true, code: true },
      });
      const publicBase = process.env['PUBLIC_WEB_URL'] ?? 'https://au-aris.org';
      await this.publishEvent(
        TOPIC_SYS_CREDENTIAL_USER_CREATED,
        {
          ...user,
          tenantName: tenant?.name ?? tenant?.code ?? null,
          temporaryPassword: plainPassword,
          loginUrl: `${publicBase}/login`,
        },
        caller,
      );
    } catch (err) {
      // Never block user creation on Kafka/tenant lookup failures
      console.error('[settings.createUser] Failed to publish welcome event:', err);
    }

    await this.invalidateUserCache();
    return { data: user };
  }

  async updateUser(id: string, dto: Record<string, unknown>, caller: AuthenticatedUser) {
    const existing = await (this.prisma as any).user.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, `User ${id} not found`);

    // Enforce tenant scope
    await this.assertUserAccess(caller, existing.tenantId);

    // Only SUPER_ADMIN can change system role
    if (dto.role !== undefined && dto.role !== existing.role) {
      if (caller.role !== 'SUPER_ADMIN') throw new HttpError(403, 'Only SUPER_ADMIN can change user roles');
    }

    const updateData: Record<string, unknown> = {};
    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.firstName !== undefined) updateData.firstName = dto.firstName;
    if (dto.lastName !== undefined) updateData.lastName = dto.lastName;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.role !== undefined) updateData.role = dto.role;
    if (dto.locale !== undefined) updateData.locale = dto.locale;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    // Hash password if provided
    if (dto.password !== undefined && typeof dto.password === 'string') {
      updateData.passwordHash = await hash(dto.password, BCRYPT_ROUNDS);
    }

    const user = await (this.prisma as any).user.update({
      where: { id },
      data: updateData,
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, locale: true, isActive: true, tenantId: true, updatedAt: true,
      },
    });

    // Sync function assignments if provided
    const functionIds = dto.functionIds as string[] | undefined;
    if (functionIds !== undefined) {
      // Remove all existing function assignments
      await (this.prisma as any).userFunction.deleteMany({ where: { userId: id } });
      // Create new ones
      if (functionIds.length > 0) {
        await (this.prisma as any).userFunction.createMany({
          data: functionIds.map((fId, idx) => ({
            userId: id,
            functionId: fId,
            isPrimary: idx === 0,
            assignedBy: caller.userId,
          })),
          skipDuplicates: true,
        });
      }
    }

    // Sync direct role assignments if provided
    const directRoleIds = dto.directRoleIds as string[] | undefined;
    if (directRoleIds !== undefined) {
      // Remove all existing direct role assignments
      await (this.prisma as any).userRoleAssignment.deleteMany({
        where: { userId: id, source: 'direct' },
      });
      // Create new direct role assignments
      if (directRoleIds.length > 0) {
        await (this.prisma as any).userRoleAssignment.createMany({
          data: directRoleIds.map((roleId) => ({
            userId: id,
            roleId,
            source: 'direct',
            assignedBy: caller.userId,
          })),
          skipDuplicates: true,
        });
      }
    }

    // Sync domain assignments if provided
    const domainIds = dto.domainIds as string[] | undefined;
    if (domainIds !== undefined) {
      await (this.prisma as any).userDomain.deleteMany({ where: { userId: id } });
      if (domainIds.length > 0) {
        await (this.prisma as any).userDomain.createMany({
          data: domainIds.map((domainId) => ({
            userId: id,
            domainId,
            assignedBy: caller.userId,
          })),
          skipDuplicates: true,
        });
      }
    }

    // Invalidate permission cache for this user
    if (this.redis) {
      try { await this.redis.del(`aris:permissions:${id}`); } catch { /* non-blocking */ }
      try { await this.redis.del(`aris:credential:user:${id}`); } catch { /* non-blocking */ }
    }

    await this.publishEvent(TOPIC_SETTINGS_USER_UPDATED, { ...user, action: 'updated' }, caller);
    await this.writeAudit('user', id, 'UPDATE', caller, {
      previousVersion: { email: existing.email, role: existing.role, isActive: existing.isActive },
      newVersion: updateData,
      classification: 'RESTRICTED',
    });
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
    await this.writeAudit('user', id, 'UPDATE', caller, { reason: 'Password reset by admin', classification: 'CONFIDENTIAL' });
    return { data: { id, passwordReset: true } };
  }

  async deleteUser(id: string, caller: AuthenticatedUser) {
    const existing = await (this.prisma as any).user.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, `User ${id} not found`);

    // Prevent deleting yourself
    if (id === caller.userId) throw new HttpError(400, 'Cannot delete your own account');

    // Delete related records that lack onDelete: Cascade, then the user
    await (this.prisma as any).$transaction([
      (this.prisma as any).collecteValidationChain.deleteMany({
        where: { OR: [{ userId: id }, { validatorId: id }, { backupValidatorId: id }] },
      }),
      (this.prisma as any).campaignAssignment.deleteMany({ where: { userId: id } }),
      (this.prisma as any).user.delete({ where: { id } }),
    ]);

    await this.publishEvent(TOPIC_SETTINGS_USER_UPDATED, { id, action: 'deleted' }, caller);
    await this.writeAudit('user', id, 'DELETE', caller, {
      previousVersion: { email: existing.email, role: existing.role, tenantId: existing.tenantId },
      classification: 'RESTRICTED',
    });
    await this.invalidateUserCache();
    return { data: { id, deleted: true } };
  }

  // ───────────────────── Statistic Definitions ─────────────────────

  async listStatisticDefinitions(query: { domainCode?: string; status?: string }) {
    const cacheKey = `aris:settings:stat-defs:list:${JSON.stringify(query)}`;
    const cached = await this.cacheGet<{ data: any[] }>(cacheKey);
    if (cached) return cached;

    const where: Record<string, unknown> = {};
    if (query.domainCode) where.domainCode = query.domainCode;
    if (query.status === 'active') where.isActive = true;
    if (query.status === 'inactive') where.isActive = false;

    const data = await (this.prisma as any).statisticDefinition.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    const result = { data };
    await this.cacheSet(cacheKey, result, CACHE_TTL_LIST);
    return result;
  }

  async createStatisticDefinition(dto: Record<string, unknown>, user: AuthenticatedUser) {
    const existing = await (this.prisma as any).statisticDefinition.findUnique({
      where: { code: dto.code as string },
    });
    if (existing) throw new HttpError(409, `Statistic definition with code "${dto.code}" already exists`);

    const statDef = await (this.prisma as any).statisticDefinition.create({
      data: {
        code: dto.code as string,
        name: (dto.name ?? {}) as Prisma.InputJsonValue,
        description: (dto.description ?? null) as Prisma.InputJsonValue,
        domainCode: dto.domainCode as string,
        icon: (dto.icon as string) ?? null,
        color: (dto.color as string) ?? null,
        unit: (dto.unit as string) ?? 'count',
        format: (dto.format as string) ?? 'number',
        sourceType: dto.sourceType as string,
        sourceConfig: (dto.sourceConfig ?? null) as Prisma.InputJsonValue,
        isActive: (dto.isActive as boolean) ?? true,
        sortOrder: (dto.sortOrder as number) ?? 0,
      },
    });

    await this.publishEvent(TOPIC_SETTINGS_STAT_DEF_UPDATED, { ...statDef, action: 'created' }, user);
    await this.invalidateStatDefCache();
    return { data: statDef };
  }

  async updateStatisticDefinition(id: string, dto: Record<string, unknown>, user: AuthenticatedUser) {
    const updateData: Record<string, unknown> = {};
    if (dto.name !== undefined) updateData.name = dto.name as Prisma.InputJsonValue;
    if (dto.description !== undefined) updateData.description = dto.description as Prisma.InputJsonValue;
    if (dto.domainCode !== undefined) updateData.domainCode = dto.domainCode;
    if (dto.icon !== undefined) updateData.icon = dto.icon;
    if (dto.color !== undefined) updateData.color = dto.color;
    if (dto.unit !== undefined) updateData.unit = dto.unit;
    if (dto.format !== undefined) updateData.format = dto.format;
    if (dto.sourceType !== undefined) updateData.sourceType = dto.sourceType;
    if (dto.sourceConfig !== undefined) updateData.sourceConfig = dto.sourceConfig as Prisma.InputJsonValue;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.sortOrder !== undefined) updateData.sortOrder = dto.sortOrder;

    try {
      const statDef = await (this.prisma as any).statisticDefinition.update({
        where: { id },
        data: updateData,
      });
      await this.publishEvent(TOPIC_SETTINGS_STAT_DEF_UPDATED, { ...statDef, action: 'updated' }, user);
      await this.invalidateStatDefCache();
      return { data: statDef };
    } catch (err: any) {
      if (err.code === 'P2025') throw new HttpError(404, `Statistic definition ${id} not found`);
      throw err;
    }
  }

  async deleteStatisticDefinition(id: string, user: AuthenticatedUser) {
    const existing = await (this.prisma as any).statisticDefinition.findUnique({
      where: { id },
      include: { _count: { select: { countryStats: true } } },
    });
    if (!existing) throw new HttpError(404, `Statistic definition ${id} not found`);

    await (this.prisma as any).statisticDefinition.delete({ where: { id } });
    await this.publishEvent(TOPIC_SETTINGS_STAT_DEF_UPDATED, { id, action: 'deleted' }, user);
    await this.invalidateStatDefCache();
    return { data: { id, deleted: true } };
  }

  // ───────────────────── Country Statistics ─────────────────────

  async getCountryStatistics(countryId: string) {
    const cacheKey = `aris:settings:country-stats:${countryId}`;
    const cached = await this.cacheGet<{ data: any[] }>(cacheKey);
    if (cached) return cached;

    const stats = await (this.prisma as any).countryStatistic.findMany({
      where: { countryId },
      include: { statistic: true },
      orderBy: { sortOrder: 'asc' },
    });

    const result = { data: stats };
    await this.cacheSet(cacheKey, result, CACHE_TTL_DETAIL);
    return result;
  }

  async upsertCountryStatistics(
    countryId: string,
    items: Array<{
      statisticId: string;
      isVisible?: boolean;
      displayPeriod?: string;
      periodStart?: string | null;
      periodEnd?: string | null;
      overrideValue?: number | null;
      sortOrder?: number;
    }>,
    user: AuthenticatedUser,
  ) {
    const country = await (this.prisma as any).country.findUnique({ where: { id: countryId } });
    if (!country) throw new HttpError(404, `Country ${countryId} not found`);

    const results = await Promise.all(
      items.map((item) =>
        (this.prisma as any).countryStatistic.upsert({
          where: { countryId_statisticId: { countryId, statisticId: item.statisticId } },
          update: {
            isVisible: item.isVisible ?? true,
            displayPeriod: item.displayPeriod ?? 'current_year',
            periodStart: item.periodStart ? new Date(item.periodStart) : null,
            periodEnd: item.periodEnd ? new Date(item.periodEnd) : null,
            overrideValue: item.overrideValue ?? null,
            sortOrder: item.sortOrder ?? 0,
          },
          create: {
            countryId,
            statisticId: item.statisticId,
            isVisible: item.isVisible ?? true,
            displayPeriod: item.displayPeriod ?? 'current_year',
            periodStart: item.periodStart ? new Date(item.periodStart) : null,
            periodEnd: item.periodEnd ? new Date(item.periodEnd) : null,
            overrideValue: item.overrideValue ?? null,
            sortOrder: item.sortOrder ?? 0,
          },
          include: { statistic: true },
        }),
      ),
    );

    await this.publishEvent(TOPIC_SETTINGS_COUNTRY_STAT_UPDATED, { countryId, action: 'upserted', count: items.length }, user);
    await this.cacheInvalidate(`aris:settings:country-stats:${countryId}`);
    await this.invalidateCountryCache();
    return { data: results };
  }

  // ───────────────────── KPI Definitions ─────────────────────

  async listKpiDefinitions(query: { domainCode?: string; status?: string; scope?: string }) {
    const cacheKey = `aris:settings:kpi-defs:list:${JSON.stringify(query)}`;
    const cached = await this.cacheGet<{ data: any[] }>(cacheKey);
    if (cached) return cached;

    const where: Record<string, unknown> = {};
    if (query.domainCode) where.domainCode = query.domainCode;
    if (query.status === 'active') where.isActive = true;
    if (query.status === 'inactive') where.isActive = false;
    if (query.scope) where.scope = query.scope;

    const data = await (this.prisma as any).kpiDefinition.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    const result = { data };
    await this.cacheSet(cacheKey, result, CACHE_TTL_LIST);
    return result;
  }

  async createKpiDefinition(dto: Record<string, unknown>, user: AuthenticatedUser) {
    const existing = await (this.prisma as any).kpiDefinition.findUnique({
      where: { code: dto.code as string },
    });
    if (existing) throw new HttpError(409, `KPI definition with code "${dto.code}" already exists`);

    const kpi = await (this.prisma as any).kpiDefinition.create({
      data: {
        code: dto.code as string,
        name: (dto.name ?? {}) as Prisma.InputJsonValue,
        description: (dto.description ?? null) as Prisma.InputJsonValue,
        domainCode: (dto.domainCode as string) ?? null,
        icon: (dto.icon as string) ?? null,
        color: (dto.color as string) ?? null,
        unit: (dto.unit as string) ?? 'percentage',
        targetValue: (dto.targetValue as number) ?? 100,
        thresholdGood: (dto.thresholdGood as number) ?? 75,
        thresholdWarn: (dto.thresholdWarn as number) ?? 50,
        scope: (dto.scope as string) ?? 'both',
        isPreset: (dto.isPreset as boolean) ?? false,
        isActive: (dto.isActive as boolean) ?? true,
        sortOrder: (dto.sortOrder as number) ?? 0,
      },
    });

    await this.publishEvent(TOPIC_SETTINGS_KPI_DEF_UPDATED, { ...kpi, action: 'created' }, user);
    await this.invalidateKpiDefCache();
    return { data: kpi };
  }

  async updateKpiDefinition(id: string, dto: Record<string, unknown>, user: AuthenticatedUser) {
    const updateData: Record<string, unknown> = {};
    if (dto.name !== undefined) updateData.name = dto.name as Prisma.InputJsonValue;
    if (dto.description !== undefined) updateData.description = dto.description as Prisma.InputJsonValue;
    if (dto.domainCode !== undefined) updateData.domainCode = dto.domainCode;
    if (dto.icon !== undefined) updateData.icon = dto.icon;
    if (dto.color !== undefined) updateData.color = dto.color;
    if (dto.unit !== undefined) updateData.unit = dto.unit;
    if (dto.targetValue !== undefined) updateData.targetValue = dto.targetValue;
    if (dto.thresholdGood !== undefined) updateData.thresholdGood = dto.thresholdGood;
    if (dto.thresholdWarn !== undefined) updateData.thresholdWarn = dto.thresholdWarn;
    if (dto.scope !== undefined) updateData.scope = dto.scope;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.sortOrder !== undefined) updateData.sortOrder = dto.sortOrder;

    try {
      const kpi = await (this.prisma as any).kpiDefinition.update({
        where: { id },
        data: updateData,
      });
      await this.publishEvent(TOPIC_SETTINGS_KPI_DEF_UPDATED, { ...kpi, action: 'updated' }, user);
      await this.invalidateKpiDefCache();
      return { data: kpi };
    } catch (err: any) {
      if (err.code === 'P2025') throw new HttpError(404, `KPI definition ${id} not found`);
      throw err;
    }
  }

  async deleteKpiDefinition(id: string, user: AuthenticatedUser) {
    const existing = await (this.prisma as any).kpiDefinition.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, `KPI definition ${id} not found`);
    if (existing.isPreset) throw new HttpError(400, 'Cannot delete a preset KPI definition. Deactivate it instead.');

    await (this.prisma as any).kpiDefinition.delete({ where: { id } });
    await this.publishEvent(TOPIC_SETTINGS_KPI_DEF_UPDATED, { id, action: 'deleted' }, user);
    await this.invalidateKpiDefCache();
    return { data: { id, deleted: true } };
  }

  // ───────────────────── Country KPI Scores ─────────────────────

  async getCountryKpiScores(countryId: string, year?: number) {
    const cacheKey = `aris:settings:country-kpis:${countryId}:${year ?? 'all'}`;
    const cached = await this.cacheGet<{ data: any[] }>(cacheKey);
    if (cached) return cached;

    const where: Record<string, unknown> = { countryId };
    if (year) where.year = year;

    const scores = await (this.prisma as any).countryKpiScore.findMany({
      where,
      include: { kpi: true },
      orderBy: [{ year: 'desc' }, { kpi: { sortOrder: 'asc' } }],
    });

    const result = { data: scores };
    await this.cacheSet(cacheKey, result, CACHE_TTL_DETAIL);
    return result;
  }

  async upsertCountryKpiScores(
    countryId: string,
    items: Array<{
      kpiId: string;
      score: number;
      year: number;
      quarter?: number | null;
      source?: string;
      notes?: string | null;
    }>,
    user: AuthenticatedUser,
  ) {
    const country = await (this.prisma as any).country.findUnique({ where: { id: countryId } });
    if (!country) throw new HttpError(404, `Country ${countryId} not found`);

    const results = await Promise.all(
      items.map((item) => {
        const quarter = item.quarter ?? null;
        // Build a unique composite key — Prisma requires all fields in @@unique
        const uniqueWhere = quarter != null
          ? { countryId_kpiId_year_quarter: { countryId, kpiId: item.kpiId, year: item.year, quarter } }
          : { countryId_kpiId_year_quarter: { countryId, kpiId: item.kpiId, year: item.year, quarter: 0 } };

        return (this.prisma as any).countryKpiScore.upsert({
          where: uniqueWhere,
          update: {
            score: item.score,
            source: item.source ?? 'manual',
            notes: item.notes ?? null,
            updatedBy: user.userId,
          },
          create: {
            countryId,
            kpiId: item.kpiId,
            score: item.score,
            year: item.year,
            quarter,
            source: item.source ?? 'manual',
            notes: item.notes ?? null,
            updatedBy: user.userId,
          },
          include: { kpi: true },
        });
      }),
    );

    await this.publishEvent(TOPIC_SETTINGS_COUNTRY_KPI_UPDATED, { countryId, action: 'upserted', count: items.length }, user);
    await this.cacheInvalidate(`aris:settings:country-kpis:${countryId}:*`);
    await this.invalidateCountryCache();
    return { data: results };
  }

  // ───────────────────── Cache invalidation helpers ─────────────────────

  private async invalidateStatDefCache(): Promise<void> {
    await Promise.all([
      this.cacheInvalidate('aris:settings:stat-defs:*'),
      this.cacheInvalidate('aris:settings:country-stats:*'),
      this.cacheInvalidate('aris:public:countries:*'),
    ]);
  }

  private async invalidateKpiDefCache(): Promise<void> {
    await Promise.all([
      this.cacheInvalidate('aris:settings:kpi-defs:*'),
      this.cacheInvalidate('aris:settings:country-kpis:*'),
      this.cacheInvalidate('aris:public:countries:*'),
    ]);
  }

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
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Kafka send timeout')), 5000),
      );
      await Promise.race([this.kafka.send(topic, key, payload, headers), timeout]);
    } catch {
      // Kafka publish failures are non-blocking
    }
  }

  /** Write an audit log entry (non-blocking) */
  async writeAudit(
    entityType: string,
    entityId: string,
    action: string,
    user: AuthenticatedUser,
    opts?: { reason?: string; previousVersion?: object; newVersion?: object; classification?: string },
  ): Promise<void> {
    try {
      await (this.prisma as any).auditLog.create({
        data: {
          entityType,
          entityId,
          action,
          actorUserId: user.userId,
          actorRole: user.role,
          actorTenantId: user.tenantId,
          reason: opts?.reason,
          previousVersion: opts?.previousVersion ?? undefined,
          newVersion: opts?.newVersion ?? undefined,
          dataClassification: opts?.classification ?? 'RESTRICTED',
          serviceName: SERVICE_NAME,
        },
      });
    } catch {
      // Audit writes are best-effort, never block the main operation
    }
  }
}

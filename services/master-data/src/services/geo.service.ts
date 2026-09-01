import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import type { StandaloneCacheService } from '@aris/cache';
import { DEFAULT_TTLS } from '@aris/cache';
import {
  TOPIC_SYS_MASTER_GEO_UPDATED,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from '@aris/shared-types';
import type {
  KafkaHeaders,
  PaginationQuery,
  PaginatedResponse,
  ApiResponse,
} from '@aris/shared-types';
import type { AuditService } from './audit.service';

const SERVICE_NAME = 'master-data-service';

interface AuthUser { userId: string; role: string; tenantId: string; tenantLevel: string }

class HttpError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}

export class GeoService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: StandaloneKafkaProducer,
    private readonly audit: AuditService,
    private readonly cache: StandaloneCacheService,
  ) {}

  /**
   * Transform a DB GeoEntity row into the multilingual format expected by the frontend.
   * DB stores: name (string), nameEn, nameFr, namePt, nameAr
   * Frontend expects: name: { en, fr, pt, ar }
   */
  private toMultilingual(entity: any): any {
    if (!entity) return entity;
    return {
      ...entity,
      name: {
        en: entity.nameEn || entity.name || '',
        fr: entity.nameFr || entity.name || '',
        pt: entity.namePt || '',
        ar: entity.nameAr || '',
      },
      // Map centroid fields to frontend-expected latitude/longitude
      latitude: entity.centroidLat ?? null,
      longitude: entity.centroidLng ?? null,
    };
  }

  /**
   * Extract flat name fields from a multilingual name object for DB storage.
   */
  private fromMultilingual(nameObj: any): { name: string; nameEn: string; nameFr: string; namePt: string; nameAr: string } {
    if (typeof nameObj === 'string') {
      return { name: nameObj, nameEn: nameObj, nameFr: nameObj, namePt: '', nameAr: '' };
    }
    if (nameObj && typeof nameObj === 'object') {
      const en = nameObj.en || '';
      return {
        name: en,
        nameEn: en,
        nameFr: nameObj.fr || '',
        namePt: nameObj.pt || '',
        nameAr: nameObj.ar || '',
      };
    }
    return { name: '', nameEn: '', nameFr: '', namePt: '', nameAr: '' };
  }

  async create(dto: any, user: AuthUser): Promise<ApiResponse<any>> {
    const existing = await (this.prisma as any).geoEntity.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new HttpError(409, `GeoEntity with code "${dto.code}" already exists`);
    }

    if (dto.parentId) {
      const parent = await (this.prisma as any).geoEntity.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent) {
        throw new HttpError(404, `Parent GeoEntity ${dto.parentId} not found`);
      }
    }

    // Accept multilingual name object or flat fields
    const nameFields = dto.nameEn
      ? { name: dto.nameEn, nameEn: dto.nameEn, nameFr: dto.nameFr || '', namePt: dto.namePt || '', nameAr: dto.nameAr || '' }
      : this.fromMultilingual(dto.name);

    const entity = await (this.prisma as any).geoEntity.create({
      data: {
        code: dto.code,
        ...nameFields,
        level: dto.level,
        parentId: dto.parentId ?? null,
        countryCode: dto.countryCode,
        centroidLat: dto.centroidLat ?? dto.latitude ?? null,
        centroidLng: dto.centroidLng ?? dto.longitude ?? null,
        isActive: dto.isActive ?? true,
      },
    });

    await this.audit.log({
      entityType: 'GeoEntity',
      entityId: entity.id,
      action: 'CREATE',
      user,
      newVersion: entity as unknown as object,
      dataClassification: 'PUBLIC',
    });

    await this.publishEvent(entity, user);
    await this.cache.invalidateByPattern('master-data', 'geo');
    return { data: this.toMultilingual(entity) };
  }

  /**
   * Idempotent "ensure" — find existing entity by name+level+countryCode+parentId,
   * or create it with an auto-generated code. Used by form submission to create
   * missing admin divisions on-the-fly.
   */
  async ensure(
    dto: { name: string; level: string; countryCode: string; parentId?: string },
    user: AuthenticatedUser,
  ): Promise<ApiResponse<any>> {
    // 1. Try to find existing entity
    const where: Record<string, unknown> = {
      level: dto.level,
      countryCode: dto.countryCode,
      isActive: true,
      OR: [
        { name: { equals: dto.name, mode: 'insensitive' } },
        { nameEn: { equals: dto.name, mode: 'insensitive' } },
        { nameFr: { equals: dto.name, mode: 'insensitive' } },
      ],
    };
    where['parentId'] = dto.parentId ?? null;

    const existing = await (this.prisma as any).geoEntity.findFirst({ where });
    if (existing) {
      return { data: this.toMultilingual(existing) };
    }

    // 2. Auto-generate code
    const levelShort = dto.level.replace('ADMIN', 'A');
    const ts = Date.now().toString(36).toUpperCase();
    let code = `${dto.countryCode}_${levelShort}_${ts}`;
    const codeExists = await (this.prisma as any).geoEntity.findUnique({ where: { code } });
    if (codeExists) {
      code = `${code}_${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
    }

    // 3. Create
    const entity = await (this.prisma as any).geoEntity.create({
      data: {
        code,
        name: dto.name,
        nameEn: dto.name,
        nameFr: dto.name,
        namePt: dto.name,
        nameAr: dto.name,
        level: dto.level,
        parentId: dto.parentId ?? null,
        countryCode: dto.countryCode,
        isActive: true,
      },
    });

    await this.publishEvent(entity, user);
    await this.cache.invalidateByPattern('master-data', 'geo');
    return { data: this.toMultilingual(entity) };
  }

  async findAll(
    query: PaginationQuery & {
      level?: string;
      countryCode?: string;
      parentId?: string;
      search?: string;
    },
  ): Promise<PaginatedResponse<any>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'asc' }
      : { code: 'asc' as const };

    const where: Record<string, unknown> = { isActive: true };
    if (query.level) where['level'] = query.level;
    if (query.countryCode) where['countryCode'] = query.countryCode;
    if (query.parentId) where['parentId'] = query.parentId;
    if (query.search) {
      where['OR'] = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { nameEn: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const cacheKey = `aris:master-data:geo:list:${JSON.stringify({ where, skip, limit, orderBy })}`;
    return this.cache.getOrSet(cacheKey, async () => {
      const [rawData, total] = await Promise.all([
        (this.prisma as any).geoEntity.findMany({
          where, skip, take: limit, orderBy,
          include: { parent: { select: { name: true, nameEn: true, nameFr: true, namePt: true, nameAr: true } } },
        }),
        (this.prisma as any).geoEntity.count({ where }),
      ]);
      const data = rawData.map((e: any) => {
        const ml = this.toMultilingual(e);
        if (e.parent) {
          ml.parentName = {
            en: e.parent.nameEn || e.parent.name || '',
            fr: e.parent.nameFr || e.parent.name || '',
            pt: e.parent.namePt || '',
            ar: e.parent.nameAr || '',
          };
        }
        delete ml.parent;
        return ml;
      });
      return { data, meta: { total, page, limit } };
    }, DEFAULT_TTLS.QUERY_RESULT);
  }

  async findOne(id: string): Promise<ApiResponse<any>> {
    const cacheKey = `aris:master-data:geo:${id}`;
    return this.cache.getOrSet(cacheKey, async () => {
      const entity = await (this.prisma as any).geoEntity.findUnique({ where: { id } });
      if (!entity) throw new HttpError(404, `GeoEntity ${id} not found`);
      return { data: this.toMultilingual(entity) };
    }, DEFAULT_TTLS.MASTER_DATA);
  }

  async findByCode(code: string): Promise<ApiResponse<any>> {
    const cacheKey = `aris:master-data:geo:code:${code}`;
    return this.cache.getOrSet(cacheKey, async () => {
      const entity = await (this.prisma as any).geoEntity.findUnique({ where: { code } });
      if (!entity) throw new HttpError(404, `GeoEntity with code "${code}" not found`);
      return { data: this.toMultilingual(entity) };
    }, DEFAULT_TTLS.MASTER_DATA);
  }

  async update(id: string, dto: any, user: AuthUser): Promise<ApiResponse<any>> {
    const existing = await (this.prisma as any).geoEntity.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, `GeoEntity ${id} not found`);
    }

    // Build update data — accept multilingual name object
    const updateData: Record<string, unknown> = {
      version: { increment: 1 },
    };
    if (dto.name !== undefined && typeof dto.name === 'object') {
      const ml = this.fromMultilingual(dto.name);
      Object.assign(updateData, ml);
    } else {
      if (dto.name !== undefined) updateData.name = dto.name;
      if (dto.nameEn !== undefined) updateData.nameEn = dto.nameEn;
      if (dto.nameFr !== undefined) updateData.nameFr = dto.nameFr;
      if (dto.namePt !== undefined) updateData.namePt = dto.namePt;
      if (dto.nameAr !== undefined) updateData.nameAr = dto.nameAr;
    }
    if (dto.centroidLat !== undefined) updateData.centroidLat = dto.centroidLat;
    if (dto.centroidLng !== undefined) updateData.centroidLng = dto.centroidLng;
    if (dto.latitude !== undefined) updateData.centroidLat = dto.latitude;
    if (dto.longitude !== undefined) updateData.centroidLng = dto.longitude;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    const entity = await (this.prisma as any).geoEntity.update({
      where: { id },
      data: updateData,
    });

    await this.audit.log({
      entityType: 'GeoEntity',
      entityId: entity.id,
      action: 'UPDATE',
      user,
      reason: dto.reason,
      previousVersion: existing as unknown as object,
      newVersion: entity as unknown as object,
      dataClassification: 'PUBLIC',
    });

    await this.publishEvent(entity, user);
    await this.cache.invalidateByPattern('master-data', 'geo');
    return { data: this.toMultilingual(entity) };
  }

  async findChildren(
    parentId: string,
    query: PaginationQuery,
  ): Promise<PaginatedResponse<any>> {
    const parent = await (this.prisma as any).geoEntity.findUnique({ where: { id: parentId } });
    if (!parent) {
      throw new HttpError(404, `GeoEntity ${parentId} not found`);
    }

    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where = { parentId, isActive: true };

    const parentName = {
      en: parent.nameEn || parent.name || '',
      fr: parent.nameFr || parent.name || '',
      pt: parent.namePt || '',
      ar: parent.nameAr || '',
    };

    const cacheKey = `aris:master-data:geo:children:${parentId}:${JSON.stringify({ skip, limit })}`;
    return this.cache.getOrSet(cacheKey, async () => {
      const [rawData, total] = await Promise.all([
        (this.prisma as any).geoEntity.findMany({ where, skip, take: limit, orderBy: { code: 'asc' } }),
        (this.prisma as any).geoEntity.count({ where }),
      ]);
      const data = rawData.map((e: any) => ({ ...this.toMultilingual(e), parentName }));
      return { data, meta: { total, page, limit } };
    }, DEFAULT_TTLS.QUERY_RESULT);
  }

  // ── GeoZone CRUD ──

  async createZone(
    dto: {
      countryCode: string;
      domainCode: string;
      code: string;
      name: Record<string, string>;
      description?: Record<string, string>;
      memberIds: string[];
      sortOrder?: number;
    },
    user: AuthUser,
  ): Promise<{ data: any }> {
    const zone = await (this.prisma as any).geoZone.create({
      data: {
        countryCode: dto.countryCode,
        domainCode: dto.domainCode,
        code: dto.code,
        name: dto.name,
        description: dto.description ?? null,
        memberIds: dto.memberIds,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
    await this.audit.log({
      entityType: 'GeoZone',
      entityId: zone.id,
      action: 'CREATE',
      user,
      newVersion: zone as unknown as object,
      dataClassification: 'PUBLIC',
    });
    await this.cache.invalidateByPattern('master-data', 'geo-zones');
    return { data: zone };
  }

  async findAllZones(query: {
    countryCode?: string;
    domainCode?: string;
    isActive?: boolean;
  }): Promise<{ data: any[] }> {
    const where: Record<string, unknown> = {};
    if (query.countryCode) where['countryCode'] = query.countryCode;
    if (query.domainCode) where['domainCode'] = query.domainCode;
    if (query.isActive !== undefined) where['isActive'] = query.isActive;

    const cacheKey = `aris:master-data:geo-zones:list:${JSON.stringify(where)}`;
    return this.cache.getOrSet(cacheKey, async () => {
      const zones = await (this.prisma as any).geoZone.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      });
      return { data: zones };
    }, DEFAULT_TTLS.QUERY_RESULT);
  }

  async findZone(id: string): Promise<{ data: any }> {
    const cacheKey = `aris:master-data:geo-zones:${id}`;
    return this.cache.getOrSet(cacheKey, async () => {
      const zone = await (this.prisma as any).geoZone.findUnique({ where: { id } });
      if (!zone) throw new HttpError(404, `GeoZone ${id} not found`);
      return { data: zone };
    }, DEFAULT_TTLS.MASTER_DATA);
  }

  async updateZone(
    id: string,
    dto: Partial<{
      name: Record<string, string>;
      description: Record<string, string>;
      memberIds: string[];
      isActive: boolean;
      sortOrder: number;
      code: string;
    }>,
    user: AuthUser,
  ): Promise<{ data: any }> {
    const existing = await (this.prisma as any).geoZone.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, `GeoZone ${id} not found`);

    const updateData: Record<string, unknown> = {};
    if (dto.name !== undefined) updateData['name'] = dto.name;
    if (dto.description !== undefined) updateData['description'] = dto.description;
    if (dto.memberIds !== undefined) updateData['memberIds'] = dto.memberIds;
    if (dto.isActive !== undefined) updateData['isActive'] = dto.isActive;
    if (dto.sortOrder !== undefined) updateData['sortOrder'] = dto.sortOrder;
    if (dto.code !== undefined) updateData['code'] = dto.code;

    const zone = await (this.prisma as any).geoZone.update({ where: { id }, data: updateData });

    await this.audit.log({
      entityType: 'GeoZone',
      entityId: zone.id,
      action: 'UPDATE',
      user,
      previousVersion: existing as unknown as object,
      newVersion: zone as unknown as object,
      dataClassification: 'PUBLIC',
    });
    await this.cache.invalidateByPattern('master-data', 'geo-zones');
    return { data: zone };
  }

  async deleteZone(id: string, user: AuthUser): Promise<{ data: { id: string } }> {
    const existing = await (this.prisma as any).geoZone.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, `GeoZone ${id} not found`);

    await (this.prisma as any).geoZone.delete({ where: { id } });

    await this.audit.log({
      entityType: 'GeoZone',
      entityId: id,
      action: 'DELETE',
      user,
      previousVersion: existing as unknown as object,
      dataClassification: 'PUBLIC',
    });
    await this.cache.invalidateByPattern('master-data', 'geo-zones');
    return { data: { id } };
  }

  private async publishEvent(
    entity: { id: string; [key: string]: unknown },
    user: AuthUser,
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
      await this.kafka.send(
        TOPIC_SYS_MASTER_GEO_UPDATED,
        entity.id as string,
        entity,
        headers,
      );
    } catch (error) {
      console.error(
        `Failed to publish geo event for ${entity.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}

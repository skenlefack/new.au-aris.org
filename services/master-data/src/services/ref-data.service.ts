import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import type { KafkaHeaders } from '@aris/shared-types';
import {
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from '@aris/shared-types';
import type { AuditService } from './audit.service';

const SERVICE_NAME = 'master-data-service';

interface AuthUser {
  userId: string;
  role: string;
  tenantId: string;
  tenantLevel: string;
}

class HttpError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}

// Map of ref-data type slugs to Prisma model names
const MODEL_MAP: Record<string, string> = {
  'species-groups': 'refSpeciesGroup',
  'species': 'refSpecies',
  'age-groups': 'refAgeGroup',
  'diseases': 'refDisease',
  'disease-species': 'refDiseaseSpecies',
  'clinical-signs': 'refClinicalSign',
  'control-measures': 'refControlMeasure',
  'seizure-reasons': 'refSeizureReason',
  'sample-types': 'refSampleType',
  'contamination-sources': 'refContaminationSource',
  'abattoirs': 'refAbattoir',
  'markets': 'refMarket',
  'checkpoints': 'refCheckpoint',
  'production-systems': 'refProductionSystem',
  // Phase 2 — 20 new types
  'breeds': 'refBreed',
  'vaccine-types': 'refVaccineType',
  'test-types': 'refTestType',
  'labs': 'refLab',
  'livestock-products': 'refLivestockProduct',
  'census-methodologies': 'refCensusMethodology',
  'gear-types': 'refGearType',
  'vessel-types': 'refVesselType',
  'aquaculture-farm-types': 'refAquacultureFarmType',
  'landing-sites': 'refLandingSite',
  'conservation-statuses': 'refConservationStatus',
  'habitat-types': 'refHabitatType',
  'crime-types': 'refCrimeType',
  'commodities': 'refCommodity',
  'hive-types': 'refHiveType',
  'bee-diseases': 'refBeeDisease',
  'floral-sources': 'refFloralSource',
  'legal-framework-types': 'refLegalFrameworkType',
  'stakeholder-types': 'refStakeholderType',
};

// Models with parent relationships (for filtered queries)
const PARENT_FILTERS: Record<string, string> = {
  'species': 'groupId',
  'age-groups': 'speciesId',
  'clinical-signs': 'diseaseId',
  'control-measures': 'diseaseId',
  'breeds': 'speciesId',
  'vaccine-types': 'diseaseId',
};

// Models with includes for related data
const INCLUDES: Record<string, object> = {
  'species': { group: { select: { id: true, code: true, name: true } } },
  'age-groups': { species: { select: { id: true, code: true, name: true } } },
  'clinical-signs': { disease: { select: { id: true, code: true, name: true } } },
  'control-measures': { disease: { select: { id: true, code: true, name: true } } },
  'diseases': {
    diseaseSpecies: {
      select: {
        id: true,
        speciesId: true,
        susceptibility: true,
        species: { select: { id: true, code: true, name: true } },
      },
    },
  },
  'breeds': { species: { select: { id: true, code: true, name: true } } },
  'vaccine-types': { disease: { select: { id: true, code: true, name: true } } },
};

export class RefDataService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: StandaloneKafkaProducer,
    private readonly audit: AuditService,
  ) {}

  /**
   * Build visibility filter based on user's scope.
   * Continental data is always visible.
   * Regional data visible to the REC that owns it + its member states.
   * National data visible only to the owning country + parent REC + AU.
   */
  private async buildVisibilityFilter(user: AuthUser): Promise<object[]> {
    const filters: object[] = [{ scope: 'continental' }];

    if (user.role === 'SUPER_ADMIN' || user.role === 'CONTINENTAL_ADMIN') {
      // See everything
      filters.push({ scope: 'regional' });
      filters.push({ scope: 'national' });
    } else if (user.role === 'REC_ADMIN') {
      // REC sees its own + its member states
      filters.push({ scope: 'regional', ownerId: user.tenantId });
      const countries = await (this.prisma as any).tenant.findMany({
        where: { parentId: user.tenantId, level: 'MEMBER_STATE', isActive: true },
        select: { id: true },
      });
      const countryIds = countries.map((c: { id: string }) => c.id);
      if (countryIds.length > 0) {
        filters.push({ scope: 'national', ownerId: { in: countryIds } });
      }
    } else {
      // National users: see their country + parent REC's regional data
      filters.push({ scope: 'national', ownerId: user.tenantId });
      // Find parent REC
      const tenant = await (this.prisma as any).tenant.findUnique({
        where: { id: user.tenantId },
        select: { parentId: true },
      });
      if (tenant?.parentId) {
        filters.push({ scope: 'regional', ownerId: tenant.parentId });
      }
    }

    return filters;
  }

  async findAll(
    type: string,
    query: Record<string, string | undefined>,
    user: AuthUser,
  ) {
    const modelName = MODEL_MAP[type];
    if (!modelName) throw new HttpError(400, `Unknown reference data type: ${type}`);

    const page = query.page ? parseInt(query.page, 10) : DEFAULT_PAGE;
    const limit = Math.min(query.limit ? parseInt(query.limit, 10) : DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const visibilityFilter = await this.buildVisibilityFilter(user);
    const where: Record<string, unknown> = { isActive: true, OR: visibilityFilter };

    // Apply parent filters
    const parentField = PARENT_FILTERS[type];
    if (parentField && query[parentField]) {
      where[parentField] = query[parentField];
    }

    // Additional type-specific filters
    if (query.scope) where['scope'] = query.scope;
    if (query.category) where['category'] = query.category;
    if (query.type && (type === 'abattoirs' || type === 'checkpoints' || type === 'markets')) {
      where['type'] = query.type;
    }
    if (query.adminLevel1 && (type === 'abattoirs' || type === 'markets')) {
      where['adminLevel1'] = query.adminLevel1;
    }
    if (query.isNotifiable && type === 'diseases') {
      where['isNotifiable'] = query.isNotifiable === 'true';
    }
    if (query.isZoonotic && type === 'diseases') {
      where['isZoonotic'] = query.isZoonotic === 'true';
    }

    // Search filter (across code + name)
    if (query.search) {
      const searchTerm = query.search;
      // Search in code and in name JSON fields
      where['AND'] = [
        {
          OR: [
            { code: { contains: searchTerm, mode: 'insensitive' } },
            { name: { path: ['en'], string_contains: searchTerm } },
            { name: { path: ['fr'], string_contains: searchTerm } },
          ],
        },
      ];
    }

    // For disease-species queries via speciesId on diseases type
    if (type === 'diseases' && query.speciesId) {
      where['diseaseSpecies'] = { some: { speciesId: query.speciesId } };
    }

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'asc' }
      : { sortOrder: 'asc' as const };

    const include = INCLUDES[type] ?? undefined;

    const [data, total] = await Promise.all([
      (this.prisma as any)[modelName].findMany({
        where, skip, take: limit, orderBy,
        ...(include ? { include } : {}),
      }),
      (this.prisma as any)[modelName].count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  /**
   * Optimized endpoint for Select dropdowns — returns only id, code, name.
   */
  async findForSelect(
    type: string,
    query: Record<string, string | undefined>,
    user: AuthUser,
  ) {
    const modelName = MODEL_MAP[type];
    if (!modelName) throw new HttpError(400, `Unknown reference data type: ${type}`);

    const visibilityFilter = await this.buildVisibilityFilter(user);
    const where: Record<string, unknown> = { isActive: true, OR: visibilityFilter };

    // Apply parent filters
    const parentField = PARENT_FILTERS[type];
    if (parentField && query[parentField]) {
      where[parentField] = query[parentField];
    }

    // Disease by species
    if (type === 'diseases' && query.speciesId) {
      where['diseaseSpecies'] = { some: { speciesId: query.speciesId } };
    }

    if (query.search) {
      where['AND'] = [
        {
          OR: [
            { code: { contains: query.search, mode: 'insensitive' } },
            { name: { path: ['en'], string_contains: query.search } },
            { name: { path: ['fr'], string_contains: query.search } },
          ],
        },
      ];
    }

    const data = await (this.prisma as any)[modelName].findMany({
      where,
      select: {
        id: true,
        code: true,
        name: true,
        scope: true,
        ownerId: true,
        ...(parentField ? { [parentField]: true } : {}),
      },
      orderBy: { sortOrder: 'asc' },
      take: 200,
    });

    return { data };
  }

  async findOne(type: string, id: string) {
    const modelName = MODEL_MAP[type];
    if (!modelName) throw new HttpError(400, `Unknown reference data type: ${type}`);

    const include = INCLUDES[type] ?? undefined;
    const entity = await (this.prisma as any)[modelName].findUnique({
      where: { id },
      ...(include ? { include } : {}),
    });
    if (!entity) throw new HttpError(404, `${type} item ${id} not found`);
    return { data: entity };
  }

  async create(type: string, dto: any, user: AuthUser) {
    const modelName = MODEL_MAP[type];
    if (!modelName) throw new HttpError(400, `Unknown reference data type: ${type}`);

    // Determine scope based on user role
    const scope = dto.scope ?? this.inferScope(user);
    const ownerId = dto.ownerId ?? this.inferOwnerId(user, scope);

    const entity = await (this.prisma as any)[modelName].create({
      data: {
        ...dto,
        scope,
        ownerId,
        ownerType: scope === 'continental' ? 'continental' : scope === 'regional' ? 'rec' : 'country',
        createdBy: user.userId,
      },
    });

    await this.audit.log({
      entityType: `Ref:${type}`,
      entityId: entity.id,
      action: 'CREATE',
      user,
      newVersion: entity as unknown as object,
      dataClassification: 'PUBLIC',
    });

    await this.publishEvent(type, entity, user);
    return { data: entity };
  }

  async update(type: string, id: string, dto: any, user: AuthUser) {
    const modelName = MODEL_MAP[type];
    if (!modelName) throw new HttpError(400, `Unknown reference data type: ${type}`);

    const existing = await (this.prisma as any)[modelName].findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, `${type} item ${id} not found`);

    // Check ownership: only allow editing if user has rights over this scope
    this.checkWriteAccess(existing, user);

    // Remove fields that shouldn't be updated directly
    const { id: _, createdAt, updatedAt, createdBy, scope, ownerId, ownerType, ...updateData } = dto;

    const entity = await (this.prisma as any)[modelName].update({
      where: { id },
      data: updateData,
    });

    await this.audit.log({
      entityType: `Ref:${type}`,
      entityId: entity.id,
      action: 'UPDATE',
      user,
      previousVersion: existing as unknown as object,
      newVersion: entity as unknown as object,
      dataClassification: 'PUBLIC',
    });

    await this.publishEvent(type, entity, user);
    return { data: entity };
  }

  async deactivate(type: string, id: string, user: AuthUser) {
    const modelName = MODEL_MAP[type];
    if (!modelName) throw new HttpError(400, `Unknown reference data type: ${type}`);

    const existing = await (this.prisma as any)[modelName].findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, `${type} item ${id} not found`);

    this.checkWriteAccess(existing, user);

    const entity = await (this.prisma as any)[modelName].update({
      where: { id },
      data: { isActive: false },
    });

    await this.audit.log({
      entityType: `Ref:${type}`,
      entityId: entity.id,
      action: 'DELETE',
      user,
      previousVersion: existing as unknown as object,
      newVersion: entity as unknown as object,
      dataClassification: 'PUBLIC',
    });

    await this.publishEvent(type, entity, user);
    return { data: entity };
  }

  /** Get counts for all reference data types (for dashboard) */
  async getCounts(user: AuthUser) {
    const visibilityFilter = await this.buildVisibilityFilter(user);
    const where = { isActive: true, OR: visibilityFilter };

    const results = await Promise.all(
      Object.entries(MODEL_MAP)
        .filter(([key]) => key !== 'disease-species')
        .map(async ([key, modelName]) => {
          const count = await (this.prisma as any)[modelName].count({ where });
          return [key, count] as [string, number];
        }),
    );

    return { data: Object.fromEntries(results) };
  }

  // ── Helpers ──

  private inferScope(user: AuthUser): string {
    if (user.role === 'SUPER_ADMIN' || user.role === 'CONTINENTAL_ADMIN') return 'continental';
    if (user.role === 'REC_ADMIN') return 'regional';
    return 'national';
  }

  private inferOwnerId(user: AuthUser, scope: string): string | null {
    if (scope === 'continental') return null;
    return user.tenantId;
  }

  private checkWriteAccess(entity: { scope: string; ownerId: string | null }, user: AuthUser) {
    if (user.role === 'SUPER_ADMIN') return;

    if (entity.scope === 'continental') {
      if (user.role !== 'CONTINENTAL_ADMIN') {
        throw new HttpError(403, 'Only SUPER_ADMIN or CONTINENTAL_ADMIN can modify continental data');
      }
      return;
    }

    if (entity.scope === 'regional') {
      if (user.role !== 'REC_ADMIN' || entity.ownerId !== user.tenantId) {
        throw new HttpError(403, 'You can only modify regional data belonging to your REC');
      }
      return;
    }

    if (entity.scope === 'national') {
      if (entity.ownerId !== user.tenantId) {
        throw new HttpError(403, 'You can only modify national data belonging to your country');
      }
    }
  }

  private async publishEvent(
    type: string,
    entity: { id: string; [key: string]: unknown },
    user: AuthUser,
  ): Promise<void> {
    const topic = `sys.master.ref-data.updated.v1`;
    const headers: KafkaHeaders = {
      correlationId: randomUUID(),
      sourceService: SERVICE_NAME,
      tenantId: user.tenantId,
      userId: user.userId,
      schemaVersion: '1',
      timestamp: new Date().toISOString(),
    };

    try {
      await this.kafka.send(topic, entity.id as string, { type, ...entity }, headers);
    } catch (error) {
      console.error(`Failed to publish ref-data event for ${type}/${entity.id}`, error instanceof Error ? error.stack : String(error));
    }
  }
}

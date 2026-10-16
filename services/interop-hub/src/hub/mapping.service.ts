// ═══════════════════════════════════════════════════════════════════
//  Mapping Manager — Referential + Field mapping CRUD & application
// ═══════════════════════════════════════════════════════════════════

import type { PrismaClient } from '@prisma/client';
import type {
  HubReferentialMapping,
  HubFieldMapping,
  HubReferentialType,
  HubDirection,
  CreateReferentialMappingDto,
  UpdateReferentialMappingDto,
  CreateFieldMappingDto,
  UpdateFieldMappingDto,
  PaginationParams,
  PaginatedResult,
  HubLogger,
} from './types';

export class MappingService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: HubLogger,
  ) {}

  // ─── Helpers ────────────────────────────────────────────────────

  private get refDb() {
    return (this.prisma as any).hubReferentialMapping;
  }

  private get fieldDb() {
    return (this.prisma as any).hubFieldMapping;
  }

  private throwHttp(statusCode: number, message: string): never {
    const err: any = new Error(message);
    err.statusCode = statusCode;
    throw err;
  }

  // ═══════════════════════════════════════════════════════════════
  //  REFERENTIAL MAPPINGS
  // ═══════════════════════════════════════════════════════════════

  async createReferentialMapping(dto: CreateReferentialMappingDto): Promise<HubReferentialMapping> {
    const mapping = await this.refDb.create({
      data: {
        connection_id: dto.connection_id,
        referential_type: dto.referential_type,
        direction: dto.direction ?? 'INBOUND',
        source_code: dto.source_code,
        source_label: dto.source_label ?? null,
        target_code: dto.target_code,
        target_label: dto.target_label ?? null,
        target_id: dto.target_id ?? null,
        is_verified: dto.is_verified ?? false,
        notes: dto.notes ?? null,
      },
    });
    return mapping as HubReferentialMapping;
  }

  async bulkCreateReferentialMappings(
    connectionId: string,
    mappings: Omit<CreateReferentialMappingDto, 'connection_id'>[],
  ): Promise<{ created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;

    for (const dto of mappings) {
      try {
        await this.refDb.create({
          data: {
            connection_id: connectionId,
            referential_type: dto.referential_type,
            direction: dto.direction ?? 'INBOUND',
            source_code: dto.source_code,
            source_label: dto.source_label ?? null,
            target_code: dto.target_code,
            target_label: dto.target_label ?? null,
            target_id: dto.target_id ?? null,
            is_verified: dto.is_verified ?? false,
            notes: dto.notes ?? null,
          },
        });
        created++;
      } catch (err: any) {
        // Unique constraint violation — skip duplicates
        if (err.code === 'P2002') {
          skipped++;
        } else {
          throw err;
        }
      }
    }

    this.logger.info(`Bulk referential mappings: ${created} created, ${skipped} skipped for connection ${connectionId}`);
    return { created, skipped };
  }

  async findAllReferentialMappings(
    connectionId: string,
    params: PaginationParams & { referential_type?: HubReferentialType; direction?: HubDirection } = {},
  ): Promise<PaginatedResult<HubReferentialMapping>> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(200, Math.max(1, params.limit ?? 50));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      connection_id: connectionId,
      is_active: true,
    };
    if (params.referential_type) where.referential_type = params.referential_type;
    if (params.direction) where.direction = params.direction;

    const [data, total] = await Promise.all([
      this.refDb.findMany({
        where,
        orderBy: [{ referential_type: 'asc' }, { source_code: 'asc' }],
        skip,
        take: limit,
      }),
      this.refDb.count({ where }),
    ]);

    return {
      data: data as HubReferentialMapping[],
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async updateReferentialMapping(id: string, dto: UpdateReferentialMappingDto): Promise<HubReferentialMapping> {
    const existing = await this.refDb.findUnique({ where: { id } });
    if (!existing) {
      this.throwHttp(404, `Referential mapping ${id} not found`);
    }

    const mapping = await this.refDb.update({
      where: { id },
      data: {
        ...(dto.source_code !== undefined && { source_code: dto.source_code }),
        ...(dto.source_label !== undefined && { source_label: dto.source_label }),
        ...(dto.target_code !== undefined && { target_code: dto.target_code }),
        ...(dto.target_label !== undefined && { target_label: dto.target_label }),
        ...(dto.target_id !== undefined && { target_id: dto.target_id }),
        ...(dto.is_verified !== undefined && { is_verified: dto.is_verified }),
        ...(dto.is_active !== undefined && { is_active: dto.is_active }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
    return mapping as HubReferentialMapping;
  }

  async deleteReferentialMapping(id: string): Promise<void> {
    const existing = await this.refDb.findUnique({ where: { id } });
    if (!existing) {
      this.throwHttp(404, `Referential mapping ${id} not found`);
    }
    await this.refDb.delete({ where: { id } });
  }

  // ═══════════════════════════════════════════════════════════════
  //  FIELD MAPPINGS
  // ═══════════════════════════════════════════════════════════════

  async createFieldMapping(dto: CreateFieldMappingDto): Promise<HubFieldMapping> {
    const mapping = await this.fieldDb.create({
      data: {
        connection_id: dto.connection_id,
        entity_type: dto.entity_type,
        direction: dto.direction,
        source_field: dto.source_field,
        target_field: dto.target_field,
        transformation: dto.transformation ?? null,
        default_value: dto.default_value ?? null,
        is_required: dto.is_required ?? false,
        notes: dto.notes ?? null,
      },
    });
    return mapping as HubFieldMapping;
  }

  async bulkCreateFieldMappings(
    connectionId: string,
    mappings: Omit<CreateFieldMappingDto, 'connection_id'>[],
  ): Promise<{ created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;

    for (const dto of mappings) {
      try {
        await this.fieldDb.create({
          data: {
            connection_id: connectionId,
            entity_type: dto.entity_type,
            direction: dto.direction,
            source_field: dto.source_field,
            target_field: dto.target_field,
            transformation: dto.transformation ?? null,
            default_value: dto.default_value ?? null,
            is_required: dto.is_required ?? false,
            notes: dto.notes ?? null,
          },
        });
        created++;
      } catch (err: any) {
        if (err.code === 'P2002') {
          skipped++;
        } else {
          throw err;
        }
      }
    }

    this.logger.info(`Bulk field mappings: ${created} created, ${skipped} skipped for connection ${connectionId}`);
    return { created, skipped };
  }

  async findAllFieldMappings(
    connectionId: string,
    params: PaginationParams & { entity_type?: string; direction?: HubDirection } = {},
  ): Promise<PaginatedResult<HubFieldMapping>> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(200, Math.max(1, params.limit ?? 50));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      connection_id: connectionId,
      is_active: true,
    };
    if (params.entity_type) where.entity_type = params.entity_type;
    if (params.direction) where.direction = params.direction;

    const [data, total] = await Promise.all([
      this.fieldDb.findMany({
        where,
        orderBy: [{ entity_type: 'asc' }, { source_field: 'asc' }],
        skip,
        take: limit,
      }),
      this.fieldDb.count({ where }),
    ]);

    return {
      data: data as HubFieldMapping[],
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async updateFieldMapping(id: string, dto: UpdateFieldMappingDto): Promise<HubFieldMapping> {
    const existing = await this.fieldDb.findUnique({ where: { id } });
    if (!existing) {
      this.throwHttp(404, `Field mapping ${id} not found`);
    }

    const mapping = await this.fieldDb.update({
      where: { id },
      data: {
        ...(dto.source_field !== undefined && { source_field: dto.source_field }),
        ...(dto.target_field !== undefined && { target_field: dto.target_field }),
        ...(dto.transformation !== undefined && { transformation: dto.transformation }),
        ...(dto.default_value !== undefined && { default_value: dto.default_value }),
        ...(dto.is_required !== undefined && { is_required: dto.is_required }),
        ...(dto.is_active !== undefined && { is_active: dto.is_active }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
    return mapping as HubFieldMapping;
  }

  async deleteFieldMapping(id: string): Promise<void> {
    const existing = await this.fieldDb.findUnique({ where: { id } });
    if (!existing) {
      this.throwHttp(404, `Field mapping ${id} not found`);
    }
    await this.fieldDb.delete({ where: { id } });
  }

  // ═══════════════════════════════════════════════════════════════
  //  APPLY MAPPINGS (used by pipeline engine)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Apply referential mappings to a batch of records.
   * Replaces source codes with target codes (ARIS referentials) based on direction.
   */
  async applyReferentialMappings(
    connectionId: string,
    records: Record<string, unknown>[],
    direction: HubDirection,
    referentialTypes?: HubReferentialType[],
  ): Promise<Record<string, unknown>[]> {
    // Load all active mappings for this connection+direction
    const where: Record<string, unknown> = {
      connection_id: connectionId,
      direction,
      is_active: true,
    };
    if (referentialTypes && referentialTypes.length > 0) {
      where.referential_type = { in: referentialTypes };
    }

    const mappings = await this.refDb.findMany({ where }) as HubReferentialMapping[];
    if (mappings.length === 0) {
      return records;
    }

    // Build lookup maps: referential_type -> source_code -> target_code
    const lookupByType = new Map<string, Map<string, { target_code: string; target_id: string | null; target_label: string | null }>>();
    for (const m of mappings) {
      if (!lookupByType.has(m.referential_type)) {
        lookupByType.set(m.referential_type, new Map());
      }
      lookupByType.get(m.referential_type)!.set(m.source_code, {
        target_code: m.target_code,
        target_id: m.target_id,
        target_label: m.target_label,
      });
    }

    // Map of referential_type -> typical field name patterns
    const fieldPatterns: Record<string, string[]> = {
      DISEASE: ['disease_code', 'disease', 'diseaseCode', 'disease_id'],
      SPECIES: ['species_code', 'species', 'speciesCode', 'species_id'],
      GEO_ADMIN: ['admin_code', 'admin1_code', 'admin2_code', 'admin3_code', 'district_code', 'region_code'],
      GEO_COUNTRY: ['country_code', 'country', 'countryCode'],
      UNIT: ['unit_code', 'unit', 'unitCode'],
      LAB: ['lab_code', 'lab', 'labCode'],
      COMMODITY: ['commodity_code', 'commodity'],
      MARKET: ['market_code', 'market'],
      VACCINE: ['vaccine_code', 'vaccine'],
      BREED: ['breed_code', 'breed'],
      AGE_GROUP: ['age_group_code', 'age_group', 'ageGroup'],
      PRODUCTION_SYSTEM: ['production_system_code', 'production_system'],
    };

    // Apply mappings to each record
    return records.map(record => {
      const mapped = { ...record };

      for (const [refType, lookup] of lookupByType) {
        const fields = fieldPatterns[refType] ?? [];
        for (const field of fields) {
          const value = mapped[field];
          if (typeof value === 'string' && lookup.has(value)) {
            const target = lookup.get(value)!;
            mapped[field] = target.target_code;
            // Also set the ID and label if target fields exist
            if (target.target_id) {
              mapped[`${field.replace(/_code$/, '')}_id`] = target.target_id;
            }
            if (target.target_label) {
              mapped[`${field.replace(/_code$/, '')}_name`] = target.target_label;
            }
          }
        }
      }

      return mapped;
    });
  }

  /**
   * Apply field mappings (JSONata transformations) to records.
   */
  async applyFieldMappings(
    connectionId: string,
    entityType: string,
    records: Record<string, unknown>[],
    direction: HubDirection,
  ): Promise<Record<string, unknown>[]> {
    const mappings = await this.fieldDb.findMany({
      where: {
        connection_id: connectionId,
        entity_type: entityType,
        direction,
        is_active: true,
      },
      orderBy: { source_field: 'asc' },
    }) as HubFieldMapping[];

    if (mappings.length === 0) {
      return records;
    }

    // Check if any mappings have JSONata transformations
    const hasTransformations = mappings.some(m => m.transformation);
    let jsonata: any = null;
    if (hasTransformations) {
      jsonata = (await import('jsonata')).default;
    }

    return Promise.all(records.map(async (record) => {
      const result: Record<string, unknown> = {};

      for (const mapping of mappings) {
        let value: unknown;

        if (mapping.transformation) {
          // Apply JSONata transformation
          try {
            const expr = jsonata(mapping.transformation);
            value = await expr.evaluate(record);
          } catch {
            value = undefined;
          }
        } else {
          // Direct copy — resolve dot-notation path
          value = getNestedValue(record, mapping.source_field);
        }

        // Apply default if value is null/undefined
        if (value === undefined || value === null) {
          value = mapping.default_value ?? undefined;
        }

        // Set target field (supports dot notation for nested)
        if (value !== undefined) {
          setNestedValue(result, mapping.target_field, value);
        }
      }

      return result;
    }));
  }

  // ═══════════════════════════════════════════════════════════════
  //  IMPORT / EXPORT
  // ═══════════════════════════════════════════════════════════════

  /**
   * Export referential mappings as JSON for a connection.
   */
  async exportReferentialMappings(connectionId: string): Promise<HubReferentialMapping[]> {
    return this.refDb.findMany({
      where: { connection_id: connectionId, is_active: true },
      orderBy: [{ referential_type: 'asc' }, { source_code: 'asc' }],
    }) as Promise<HubReferentialMapping[]>;
  }

  /**
   * Export field mappings as JSON for a connection.
   */
  async exportFieldMappings(connectionId: string): Promise<HubFieldMapping[]> {
    return this.fieldDb.findMany({
      where: { connection_id: connectionId, is_active: true },
      orderBy: [{ entity_type: 'asc' }, { source_field: 'asc' }],
    }) as Promise<HubFieldMapping[]>;
  }

  /**
   * Import referential mappings from JSON array (upsert behavior).
   */
  async importReferentialMappings(
    connectionId: string,
    data: Array<{ referential_type: HubReferentialType; direction: HubDirection; source_code: string; source_label?: string; target_code: string; target_label?: string; target_id?: string }>,
  ): Promise<{ created: number; skipped: number }> {
    return this.bulkCreateReferentialMappings(connectionId, data);
  }

  /**
   * Import field mappings from JSON array.
   */
  async importFieldMappings(
    connectionId: string,
    data: Array<{ entity_type: string; direction: HubDirection; source_field: string; target_field: string; transformation?: string; default_value?: string; is_required?: boolean }>,
  ): Promise<{ created: number; skipped: number }> {
    return this.bulkCreateFieldMappings(connectionId, data);
  }
}

// ─── Utility functions ────────────────────────────────────────────

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current) || typeof current[part] !== 'object' || current[part] === null) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}

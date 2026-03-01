import type { PrismaClient, Prisma } from '@prisma/client';
import type { ApiResponse } from '@aris/shared-types';
import type { AuditService } from './audit.service';
import {
  parseCsv,
  toCsv,
  validateGeoRow,
  validateSpeciesRow,
  validateDiseaseRow,
  validateUnitRow,
  validateIdentifierRow,
  validateDenominatorRow,
} from './csv-parser.util';
import type { ValidationResult } from './csv-parser.util';

// Referential types (replaces class-validator enum DTO)
export enum ReferentialType {
  COUNTRIES = 'countries',
  GEO_ENTITIES = 'geo_entities',
  SPECIES = 'species',
  DISEASES = 'diseases',
  UNITS = 'units',
  IDENTIFIERS = 'identifiers',
  DENOMINATORS = 'denominators',
}

export interface ImportReportRow {
  row: number;
  code: string;
  action: 'created' | 'updated' | 'skipped';
  error?: string;
}

export interface ImportReport {
  type: string;
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  details: ImportReportRow[];
}

interface AuthUser { userId: string; role: string; tenantId: string; tenantLevel: string }

class HttpError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}

export class ImportExportService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly audit: AuditService,
  ) {}

  // -- CSV Import --

  async importCsv(
    body: { type: string; csvContent: string; reason?: string },
    user: AuthUser,
  ): Promise<ApiResponse<ImportReport>> {
    const type = body.type as ReferentialType;
    const csvContent = body.csvContent;
    const reason = body.reason;

    const parsed = parseCsv(csvContent);

    if (parsed.errors.length > 0 && parsed.rows.length === 0) {
      throw new HttpError(400, `Failed to parse CSV: ${parsed.errors.map(e => e.message).join('; ')}`);
    }

    const report: ImportReport = {
      type,
      totalRows: parsed.rows.length,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: parsed.errors.length,
      details: parsed.errors.map((e) => ({
        row: e.row,
        code: '',
        action: 'skipped' as const,
        error: e.message,
      })),
    };

    for (let i = 0; i < parsed.rows.length; i++) {
      const row = parsed.rows[i];
      const rowNum = i + 2; // 1-indexed, skip header

      try {
        const result = await this.importRow(type, row, rowNum, user, reason);
        report.details.push(result);
        if (result.action === 'created') report.created++;
        else if (result.action === 'updated') report.updated++;
        else report.skipped++;
        if (result.error) report.errors++;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        report.details.push({ row: rowNum, code: row['code'] ?? '', action: 'skipped', error: msg });
        report.skipped++;
        report.errors++;
      }
    }

    return { data: report };
  }

  private async importRow(
    type: ReferentialType,
    row: Record<string, string>,
    rowNum: number,
    user: AuthUser,
    reason?: string,
  ): Promise<ImportReportRow> {
    const validatorMap: Record<ReferentialType, (r: Record<string, string>) => ValidationResult> = {
      [ReferentialType.COUNTRIES]: validateGeoRow,
      [ReferentialType.GEO_ENTITIES]: validateGeoRow,
      [ReferentialType.SPECIES]: validateSpeciesRow,
      [ReferentialType.DISEASES]: validateDiseaseRow,
      [ReferentialType.UNITS]: validateUnitRow,
      [ReferentialType.IDENTIFIERS]: validateIdentifierRow,
      [ReferentialType.DENOMINATORS]: validateDenominatorRow,
    };

    const validation = validatorMap[type](row);
    if (!validation.valid) {
      return {
        row: rowNum,
        code: row['code'] ?? '',
        action: 'skipped',
        error: validation.errors.join('; '),
      };
    }

    const upsertMap: Record<ReferentialType, () => Promise<ImportReportRow>> = {
      [ReferentialType.COUNTRIES]: () => this.upsertGeo(row, rowNum, user, reason),
      [ReferentialType.GEO_ENTITIES]: () => this.upsertGeo(row, rowNum, user, reason),
      [ReferentialType.SPECIES]: () => this.upsertSpecies(row, rowNum, user, reason),
      [ReferentialType.DISEASES]: () => this.upsertDisease(row, rowNum, user, reason),
      [ReferentialType.UNITS]: () => this.upsertUnit(row, rowNum, user, reason),
      [ReferentialType.IDENTIFIERS]: () => this.upsertIdentifier(row, rowNum, user, reason),
      [ReferentialType.DENOMINATORS]: () => this.upsertDenominator(row, rowNum, user, reason),
    };

    return upsertMap[type]();
  }

  private async upsertGeo(
    row: Record<string, string>,
    rowNum: number,
    user: AuthUser,
    reason?: string,
  ): Promise<ImportReportRow> {
    const code = row['code'];
    const existing = await (this.prisma as any).geoEntity.findUnique({ where: { code } });

    let parentId: string | null = null;
    if (row['parent_code']) {
      const parent = await (this.prisma as any).geoEntity.findUnique({ where: { code: row['parent_code'] } });
      parentId = parent?.id ?? null;
    }

    const data = {
      name: row['name'] || row['name_en'],
      nameEn: row['name_en'],
      nameFr: row['name_fr'],
      level: row['level'].toUpperCase() as 'COUNTRY' | 'ADMIN1' | 'ADMIN2' | 'ADMIN3' | 'SPECIAL_ZONE',
      countryCode: row['country_code'],
      parentId,
      centroidLat: row['centroid_lat'] ? parseFloat(row['centroid_lat']) : null,
      centroidLng: row['centroid_lng'] ? parseFloat(row['centroid_lng']) : null,
    };

    if (existing) {
      await (this.prisma as any).geoEntity.update({
        where: { code },
        data: { ...data, version: { increment: 1 } },
      });
      await this.audit.log({
        entityType: 'GeoEntity', entityId: existing.id, action: 'UPDATE',
        user, reason, previousVersion: existing as unknown as object, dataClassification: 'PUBLIC',
      });
      return { row: rowNum, code, action: 'updated' };
    }

    const created = await (this.prisma as any).geoEntity.create({ data: { code, ...data } });
    await this.audit.log({
      entityType: 'GeoEntity', entityId: created.id, action: 'CREATE',
      user, reason, newVersion: created as unknown as object, dataClassification: 'PUBLIC',
    });
    return { row: rowNum, code, action: 'created' };
  }

  private async upsertSpecies(
    row: Record<string, string>,
    rowNum: number,
    user: AuthUser,
    reason?: string,
  ): Promise<ImportReportRow> {
    const code = row['code'];
    const existing = await (this.prisma as any).species.findUnique({ where: { code } });

    const prodCats = row['production_categories']
      ? row['production_categories'].split(';').map((s: string) => s.trim()).filter(Boolean)
      : [];

    const data = {
      scientificName: row['scientific_name'],
      commonNameEn: row['common_name_en'],
      commonNameFr: row['common_name_fr'],
      category: row['category'].toUpperCase() as 'DOMESTIC' | 'WILDLIFE' | 'AQUATIC' | 'APICULTURE',
      productionCategories: prodCats,
      isWoahListed: row['is_woah_listed']?.toLowerCase() === 'true',
    };

    if (existing) {
      await (this.prisma as any).species.update({
        where: { code },
        data: { ...data, version: { increment: 1 } },
      });
      await this.audit.log({
        entityType: 'Species', entityId: existing.id, action: 'UPDATE',
        user, reason, previousVersion: existing as unknown as object, dataClassification: 'PUBLIC',
      });
      return { row: rowNum, code, action: 'updated' };
    }

    const created = await (this.prisma as any).species.create({ data: { code, ...data } });
    await this.audit.log({
      entityType: 'Species', entityId: created.id, action: 'CREATE',
      user, reason, newVersion: created as unknown as object, dataClassification: 'PUBLIC',
    });
    return { row: rowNum, code, action: 'created' };
  }

  private async upsertDisease(
    row: Record<string, string>,
    rowNum: number,
    user: AuthUser,
    reason?: string,
  ): Promise<ImportReportRow> {
    const code = row['code'];
    const existing = await (this.prisma as any).disease.findUnique({ where: { code } });

    const affected = row['affected_species']
      ? row['affected_species'].split(';').map((s: string) => s.trim()).filter(Boolean)
      : [];

    const data = {
      nameEn: row['name_en'],
      nameFr: row['name_fr'],
      isWoahListed: row['is_woah_listed']?.toLowerCase() === 'true',
      affectedSpecies: affected,
      isNotifiable: row['is_notifiable']?.toLowerCase() === 'true',
      wahisCategory: row['wahis_category'] || null,
    };

    if (existing) {
      await (this.prisma as any).disease.update({
        where: { code },
        data: { ...data, version: { increment: 1 } },
      });
      await this.audit.log({
        entityType: 'Disease', entityId: existing.id, action: 'UPDATE',
        user, reason, previousVersion: existing as unknown as object, dataClassification: 'PUBLIC',
      });
      return { row: rowNum, code, action: 'updated' };
    }

    const created = await (this.prisma as any).disease.create({ data: { code, ...data } });
    await this.audit.log({
      entityType: 'Disease', entityId: created.id, action: 'CREATE',
      user, reason, newVersion: created as unknown as object, dataClassification: 'PUBLIC',
    });
    return { row: rowNum, code, action: 'created' };
  }

  private async upsertUnit(
    row: Record<string, string>,
    rowNum: number,
    user: AuthUser,
    reason?: string,
  ): Promise<ImportReportRow> {
    const code = row['code'];
    const existing = await (this.prisma as any).unit.findUnique({ where: { code } });

    const data = {
      nameEn: row['name_en'],
      nameFr: row['name_fr'],
      symbol: row['symbol'],
      category: row['category'].toUpperCase() as 'COUNT' | 'WEIGHT' | 'VOLUME' | 'AREA' | 'LENGTH' | 'DOSE' | 'CURRENCY' | 'PROPORTION' | 'TIME',
      siConversion: row['si_conversion'] ? parseFloat(row['si_conversion']) : null,
    };

    if (existing) {
      await (this.prisma as any).unit.update({
        where: { code },
        data: { ...data, version: { increment: 1 } },
      });
      await this.audit.log({
        entityType: 'Unit', entityId: existing.id, action: 'UPDATE',
        user, reason, previousVersion: existing as unknown as object, dataClassification: 'PUBLIC',
      });
      return { row: rowNum, code, action: 'updated' };
    }

    const created = await (this.prisma as any).unit.create({ data: { code, ...data } });
    await this.audit.log({
      entityType: 'Unit', entityId: created.id, action: 'CREATE',
      user, reason, newVersion: created as unknown as object, dataClassification: 'PUBLIC',
    });
    return { row: rowNum, code, action: 'created' };
  }

  private async upsertIdentifier(
    row: Record<string, string>,
    rowNum: number,
    user: AuthUser,
    reason?: string,
  ): Promise<ImportReportRow> {
    const code = row['code'];
    const existing = await (this.prisma as any).identifier.findUnique({ where: { code } });

    let geoEntityId: string | null = null;
    if (row['geo_entity_code']) {
      const geo = await (this.prisma as any).geoEntity.findUnique({ where: { code: row['geo_entity_code'] } });
      geoEntityId = geo?.id ?? null;
    }

    const data = {
      nameEn: row['name_en'],
      nameFr: row['name_fr'],
      type: row['type'].toUpperCase() as 'LAB' | 'MARKET' | 'BORDER_POINT' | 'PROTECTED_AREA' | 'SLAUGHTERHOUSE' | 'QUARANTINE_STATION',
      geoEntityId,
      latitude: row['latitude'] ? parseFloat(row['latitude']) : null,
      longitude: row['longitude'] ? parseFloat(row['longitude']) : null,
      address: row['address'] || null,
      contactInfo: {} as Prisma.InputJsonValue,
    };

    if (existing) {
      await (this.prisma as any).identifier.update({
        where: { code },
        data: { ...data, version: { increment: 1 } },
      });
      await this.audit.log({
        entityType: 'Identifier', entityId: existing.id, action: 'UPDATE',
        user, reason, previousVersion: existing as unknown as object, dataClassification: 'PUBLIC',
      });
      return { row: rowNum, code, action: 'updated' };
    }

    const created = await (this.prisma as any).identifier.create({ data: { code, ...data } });
    await this.audit.log({
      entityType: 'Identifier', entityId: created.id, action: 'CREATE',
      user, reason, newVersion: created as unknown as object, dataClassification: 'PUBLIC',
    });
    return { row: rowNum, code, action: 'created' };
  }

  private async upsertDenominator(
    row: Record<string, string>,
    rowNum: number,
    user: AuthUser,
    reason?: string,
  ): Promise<ImportReportRow> {
    const countryCode = row['country_code'];
    const speciesCode = row['species_code'];
    const year = parseInt(row['year'], 10);
    const source = row['source'].toUpperCase() as 'FAOSTAT' | 'NATIONAL_CENSUS' | 'ESTIMATE';
    const code = `${countryCode}-${speciesCode}-${year}-${source}`;

    const species = await (this.prisma as any).species.findUnique({ where: { code: speciesCode } });
    if (!species) {
      return { row: rowNum, code, action: 'skipped', error: `Species "${speciesCode}" not found` };
    }

    const geoEntity = await (this.prisma as any).geoEntity.findUnique({ where: { code: countryCode } });

    const existing = await (this.prisma as any).denominator.findFirst({
      where: { countryCode, speciesId: species.id, year, source },
    });

    const data = {
      countryCode,
      speciesId: species.id,
      geoEntityId: geoEntity?.id ?? null,
      year,
      source,
      population: BigInt(row['population']),
      assumptions: row['assumptions'] || null,
    };

    if (existing) {
      await (this.prisma as any).denominator.update({
        where: { id: existing.id },
        data: { ...data, version: { increment: 1 } },
      });
      await this.audit.log({
        entityType: 'Denominator', entityId: existing.id, action: 'UPDATE',
        user, reason, previousVersion: existing as unknown as object, dataClassification: 'PUBLIC',
      });
      return { row: rowNum, code, action: 'updated' };
    }

    const created = await (this.prisma as any).denominator.create({ data });
    await this.audit.log({
      entityType: 'Denominator', entityId: created.id, action: 'CREATE',
      user, reason, newVersion: created as unknown as object, dataClassification: 'PUBLIC',
    });
    return { row: rowNum, code, action: 'created' };
  }

  // -- CSV Export --

  async exportCsv(type: string): Promise<string> {
    switch (type) {
      case ReferentialType.COUNTRIES:
        return this.exportGeo('COUNTRY');
      case ReferentialType.GEO_ENTITIES:
        return this.exportGeo();
      case ReferentialType.SPECIES:
        return this.exportSpecies();
      case ReferentialType.DISEASES:
        return this.exportDiseases();
      case ReferentialType.UNITS:
        return this.exportUnits();
      case ReferentialType.IDENTIFIERS:
        return this.exportIdentifiers();
      case ReferentialType.DENOMINATORS:
        return this.exportDenominators();
      default:
        throw new HttpError(400, `Unknown referential type: ${type}`);
    }
  }

  private async exportGeo(level?: string): Promise<string> {
    const where: Record<string, unknown> = { isActive: true };
    if (level) where['level'] = level;
    const data = await (this.prisma as any).geoEntity.findMany({ where, orderBy: { code: 'asc' } });
    const headers = ['code', 'name', 'name_en', 'name_fr', 'level', 'country_code', 'centroid_lat', 'centroid_lng', 'version'];
    return toCsv(
      headers,
      data.map((d: any) => ({
        code: d.code, name: d.name, name_en: d.nameEn, name_fr: d.nameFr,
        level: d.level, country_code: d.countryCode,
        centroid_lat: d.centroidLat, centroid_lng: d.centroidLng, version: d.version,
      })),
    );
  }

  private async exportSpecies(): Promise<string> {
    const data = await (this.prisma as any).species.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } });
    const headers = ['code', 'scientific_name', 'common_name_en', 'common_name_fr', 'category', 'production_categories', 'is_woah_listed', 'version'];
    return toCsv(
      headers,
      data.map((d: any) => ({
        code: d.code, scientific_name: d.scientificName, common_name_en: d.commonNameEn,
        common_name_fr: d.commonNameFr, category: d.category,
        production_categories: d.productionCategories.join(';'),
        is_woah_listed: d.isWoahListed, version: d.version,
      })),
    );
  }

  private async exportDiseases(): Promise<string> {
    const data = await (this.prisma as any).disease.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } });
    const headers = ['code', 'name_en', 'name_fr', 'is_woah_listed', 'affected_species', 'is_notifiable', 'wahis_category', 'version'];
    return toCsv(
      headers,
      data.map((d: any) => ({
        code: d.code, name_en: d.nameEn, name_fr: d.nameFr,
        is_woah_listed: d.isWoahListed, affected_species: d.affectedSpecies.join(';'),
        is_notifiable: d.isNotifiable, wahis_category: d.wahisCategory, version: d.version,
      })),
    );
  }

  private async exportUnits(): Promise<string> {
    const data = await (this.prisma as any).unit.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } });
    const headers = ['code', 'name_en', 'name_fr', 'symbol', 'category', 'si_conversion', 'version'];
    return toCsv(
      headers,
      data.map((d: any) => ({
        code: d.code, name_en: d.nameEn, name_fr: d.nameFr,
        symbol: d.symbol, category: d.category, si_conversion: d.siConversion, version: d.version,
      })),
    );
  }

  private async exportIdentifiers(): Promise<string> {
    const data = await (this.prisma as any).identifier.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } });
    const headers = ['code', 'name_en', 'name_fr', 'type', 'latitude', 'longitude', 'address', 'version'];
    return toCsv(
      headers,
      data.map((d: any) => ({
        code: d.code, name_en: d.nameEn, name_fr: d.nameFr,
        type: d.type, latitude: d.latitude, longitude: d.longitude,
        address: d.address, version: d.version,
      })),
    );
  }

  private async exportDenominators(): Promise<string> {
    const data = await (this.prisma as any).denominator.findMany({
      where: { isActive: true },
      include: { species: { select: { code: true } } },
      orderBy: [{ countryCode: 'asc' }, { year: 'asc' }],
    });
    const headers = ['country_code', 'species_code', 'year', 'source', 'population', 'assumptions', 'version'];
    return toCsv(
      headers,
      data.map((d: any) => ({
        country_code: d.countryCode, species_code: d.species.code, year: d.year,
        source: d.source, population: d.population.toString(),
        assumptions: d.assumptions, version: d.version,
      })),
    );
  }

  // -- FAOSTAT Import (special format) --

  async importFaostat(
    body: { csvContent: string; reason?: string },
    user: AuthUser,
  ): Promise<ApiResponse<ImportReport>> {
    const csvContent = body.csvContent;
    const reason = body.reason;

    const parsed = parseCsv(csvContent);

    if (parsed.rows.length === 0) {
      throw new HttpError(400, 'Empty FAOSTAT CSV');
    }

    // FAOSTAT format: Area Code,Area,Item Code,Item,Element,Year,Unit,Value
    const requiredHeaders = ['area code', 'item code', 'year', 'value'];
    const missingHeaders = requiredHeaders.filter((h) => !parsed.headers.includes(h));
    if (missingHeaders.length > 0) {
      throw new HttpError(
        400,
        `Missing FAOSTAT headers: ${missingHeaders.join(', ')}. Expected: Area Code, Item Code, Year, Value`,
      );
    }

    const report: ImportReport = {
      type: 'faostat',
      totalRows: parsed.rows.length,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      details: [],
    };

    for (let i = 0; i < parsed.rows.length; i++) {
      const row = parsed.rows[i];
      const rowNum = i + 2;
      const countryCode = row['area code'] ?? '';
      const itemCode = row['item code'] ?? '';
      const year = parseInt(row['year'] ?? '', 10);
      const value = parseInt((row['value'] ?? '').replace(/,/g, ''), 10);
      const code = `${countryCode}-${itemCode}-${year}`;

      if (!countryCode || !itemCode || isNaN(year) || isNaN(value)) {
        report.details.push({ row: rowNum, code, action: 'skipped', error: 'Invalid FAOSTAT row data' });
        report.skipped++;
        report.errors++;
        continue;
      }

      // Map FAOSTAT item codes to ARIS species codes
      const speciesCode = this.mapFaostatItemCode(itemCode);
      if (!speciesCode) {
        report.details.push({ row: rowNum, code, action: 'skipped', error: `Unknown FAOSTAT item code: ${itemCode}` });
        report.skipped++;
        report.errors++;
        continue;
      }

      const species = await (this.prisma as any).species.findUnique({ where: { code: speciesCode } });
      if (!species) {
        report.details.push({ row: rowNum, code, action: 'skipped', error: `Species ${speciesCode} not in DB` });
        report.skipped++;
        report.errors++;
        continue;
      }

      const geoEntity = await (this.prisma as any).geoEntity.findUnique({ where: { code: countryCode } });

      const existing = await (this.prisma as any).denominator.findFirst({
        where: { countryCode, speciesId: species.id, year, source: 'FAOSTAT' },
      });

      const denomData = {
        countryCode,
        speciesId: species.id,
        geoEntityId: geoEntity?.id ?? null,
        year,
        source: 'FAOSTAT' as const,
        population: BigInt(value),
        assumptions: `FAOSTAT import, item code ${itemCode}`,
      };

      if (existing) {
        await (this.prisma as any).denominator.update({
          where: { id: existing.id },
          data: { ...denomData, version: { increment: 1 } },
        });
        await this.audit.log({
          entityType: 'Denominator', entityId: existing.id, action: 'UPDATE',
          user, reason: reason ?? 'FAOSTAT sync', dataClassification: 'PUBLIC',
        });
        report.details.push({ row: rowNum, code, action: 'updated' });
        report.updated++;
      } else {
        const created = await (this.prisma as any).denominator.create({ data: denomData });
        await this.audit.log({
          entityType: 'Denominator', entityId: created.id, action: 'CREATE',
          user, reason: reason ?? 'FAOSTAT sync', dataClassification: 'PUBLIC',
        });
        report.details.push({ row: rowNum, code, action: 'created' });
        report.created++;
      }
    }

    return { data: report };
  }

  private mapFaostatItemCode(itemCode: string): string | null {
    const mapping: Record<string, string> = {
      '866': 'BOS-TAU',   // Cattle
      '976': 'OVI-ARI',   // Sheep
      '1016': 'CAP-HIR',  // Goats
      '1034': 'SUS-DOM',  // Pigs
      '1057': 'GAL-DOM',  // Chickens
      '1068': 'MEL-GAL',  // Turkeys
      '1072': 'ANA-PLA',  // Ducks
      '946': 'BUB-BUB',   // Buffaloes
      '1096': 'CAM-DRO',  // Camels
      '1107': 'EQU-CAB',  // Horses
      '1110': 'EQU-ASI',  // Asses (Donkeys)
      '1140': 'ORC-CUN',  // Rabbits
      '1181': 'API-MEL',  // Beehives
    };
    return mapping[itemCode] ?? null;
  }
}

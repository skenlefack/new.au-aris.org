import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import { v4 as uuidv4 } from 'uuid';
import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import {
  TOPIC_MS_FISHERIES_CAPTURE_CREATED,
  TOPIC_MS_FISHERIES_VESSEL_CREATED,
  TOPIC_MS_FISHERIES_AQUACULTURE_FARM_CREATED,
  TOPIC_MS_FISHERIES_AQUACULTURE_PRODUCTION_CREATED,
  TOPIC_MS_FISHERIES_EFFORT_CREATED,
} from '@aris/shared-types';
import type { KafkaHeaders } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

interface ImportResult {
  imported: number;
  skipped: number;
  errors: Array<{ row: number; field: string; message: string }>;
}

const SERVICE_NAME = 'fisheries-service';

export class ImportService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: StandaloneKafkaProducer,
  ) {}

  // ---------------------------------------------------------------------------
  // File parsing
  // ---------------------------------------------------------------------------

  private async parseFile(buffer: Buffer, format: 'xlsx' | 'csv'): Promise<Record<string, any>[]> {
    if (format === 'csv') {
      return parse(buffer, { columns: true, skip_empty_lines: true, trim: true });
    }

    // xlsx
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) return [];

    const headers: string[] = [];
    const rows: Record<string, any>[] = [];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        row.eachCell((cell, colNumber) => {
          headers[colNumber - 1] = String(cell.value);
        });
      } else {
        const obj: Record<string, any> = {};
        row.eachCell((cell, colNumber) => {
          obj[headers[colNumber - 1]] = cell.value;
        });
        rows.push(obj);
      }
    });

    return rows;
  }

  // ---------------------------------------------------------------------------
  // Import: Captures
  // ---------------------------------------------------------------------------

  async importCaptures(buffer: Buffer, format: 'xlsx' | 'csv', user: AuthenticatedUser): Promise<ImportResult> {
    const rows = await this.parseFile(buffer, format);
    const result: ImportResult = { imported: 0, skipped: 0, errors: [] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        // Validate required fields
        if (!row.speciesId && !row.speciesCode) {
          result.errors.push({ row: i + 2, field: 'speciesId/speciesCode', message: 'Required' });
          result.skipped++;
          continue;
        }

        // Resolve speciesId from speciesCode (faoAlphaCode) if needed
        let speciesId = row.speciesId;
        if (!speciesId && row.speciesCode) {
          const species = await (this.prisma as any).species.findFirst({
            where: { faoAlphaCode: row.speciesCode },
          });
          if (!species) {
            // Also try by code
            const speciesByCode = await (this.prisma as any).species.findFirst({
              where: { code: row.speciesCode },
            });
            if (!speciesByCode) {
              result.errors.push({ row: i + 2, field: 'speciesCode', message: `Species not found: ${row.speciesCode}` });
              result.skipped++;
              continue;
            }
            speciesId = speciesByCode.id;
          } else {
            speciesId = species.id;
          }
        }

        // Resolve geoEntityId from countryCode if needed
        let geoEntityId = row.geoEntityId;
        if (!geoEntityId && row.countryCode) {
          const geo = await (this.prisma as any).geoEntity.findFirst({
            where: { code: row.countryCode },
          });
          geoEntityId = geo?.id ?? null;
        }

        if (!row.captureDate) {
          result.errors.push({ row: i + 2, field: 'captureDate', message: 'Required' });
          result.skipped++;
          continue;
        }

        const entity = await (this.prisma as any).fishCapture.create({
          data: {
            tenantId: user.tenantId,
            speciesId,
            faoAreaCode: row.faoAreaCode ?? 'UNKNOWN',
            gearType: row.gearType ?? 'UNKNOWN',
            quantityKg: parseFloat(row.quantityKg) || 0,
            landingSite: row.landingSite ?? 'UNKNOWN',
            captureDate: new Date(row.captureDate),
            geoEntityId: geoEntityId ?? null,
            vesselId: row.vesselId ?? null,
            fishingEnvironment: row.fishingEnvironment ?? null,
            productionType: row.productionType ?? null,
            status: row.status ?? 'DRAFT',
            dataClassification: 'PARTNER',
            createdBy: user.userId,
            updatedBy: user.userId,
          },
        });

        await this.publishEvent(TOPIC_MS_FISHERIES_CAPTURE_CREATED, entity, user);
        result.imported++;
      } catch (err: any) {
        result.errors.push({ row: i + 2, field: 'general', message: err.message });
        result.skipped++;
      }
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Import: Vessels
  // ---------------------------------------------------------------------------

  async importVessels(buffer: Buffer, format: 'xlsx' | 'csv', user: AuthenticatedUser): Promise<ImportResult> {
    const rows = await this.parseFile(buffer, format);
    const result: ImportResult = { imported: 0, skipped: 0, errors: [] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        if (!row.name) {
          result.errors.push({ row: i + 2, field: 'name', message: 'Required' });
          result.skipped++;
          continue;
        }
        if (!row.registrationNumber) {
          result.errors.push({ row: i + 2, field: 'registrationNumber', message: 'Required' });
          result.skipped++;
          continue;
        }

        // Check duplicate registration number per tenant
        const existing = await (this.prisma as any).fishingVessel.findFirst({
          where: {
            tenantId: user.tenantId,
            registrationNumber: String(row.registrationNumber),
          },
        });

        if (existing) {
          result.errors.push({ row: i + 2, field: 'registrationNumber', message: `Duplicate: ${row.registrationNumber}` });
          result.skipped++;
          continue;
        }

        const entity = await (this.prisma as any).fishingVessel.create({
          data: {
            tenantId: user.tenantId,
            name: row.name,
            registrationNumber: String(row.registrationNumber),
            flagState: row.flagState ?? 'UNKNOWN',
            vesselType: row.vesselType ?? 'UNKNOWN',
            lengthMeters: parseFloat(row.lengthMeters) || 0,
            tonnageGt: parseFloat(row.tonnageGt) || 0,
            homePort: row.homePort ?? 'UNKNOWN',
            enginePowerKw: row.enginePowerKw ? parseFloat(row.enginePowerKw) : null,
            crewCapacity: row.crewCapacity ? parseInt(row.crewCapacity, 10) : null,
            ownerName: row.ownerName ?? null,
            dataClassification: 'PARTNER',
            createdBy: user.userId,
            updatedBy: user.userId,
          },
        });

        await this.publishEvent(TOPIC_MS_FISHERIES_VESSEL_CREATED, entity, user);
        result.imported++;
      } catch (err: any) {
        result.errors.push({ row: i + 2, field: 'general', message: err.message });
        result.skipped++;
      }
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Import: Aquaculture Farms
  // ---------------------------------------------------------------------------

  async importFarms(buffer: Buffer, format: 'xlsx' | 'csv', user: AuthenticatedUser): Promise<ImportResult> {
    const rows = await this.parseFile(buffer, format);
    const result: ImportResult = { imported: 0, skipped: 0, errors: [] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        if (!row.name) {
          result.errors.push({ row: i + 2, field: 'name', message: 'Required' });
          result.skipped++;
          continue;
        }
        if (!row.farmType) {
          result.errors.push({ row: i + 2, field: 'farmType', message: 'Required' });
          result.skipped++;
          continue;
        }

        // Resolve geoEntityId from countryCode if needed
        let geoEntityId = row.geoEntityId;
        if (!geoEntityId && row.countryCode) {
          const geo = await (this.prisma as any).geoEntity.findFirst({
            where: { code: row.countryCode },
          });
          geoEntityId = geo?.id ?? null;
        }

        const entity = await (this.prisma as any).aquacultureFarm.create({
          data: {
            tenantId: user.tenantId,
            name: row.name,
            farmType: row.farmType,
            waterSource: row.waterSource ?? 'UNKNOWN',
            areaHectares: parseFloat(row.areaHectares) || 0,
            speciesIds: [],
            productionCapacityTonnes: parseFloat(row.productionCapacityTonnes) || 0,
            geoEntityId: geoEntityId ?? user.tenantId,
            coordinates: {},
            ownerName: row.ownerName ?? null,
            totalWorkers: row.totalWorkers ? parseInt(row.totalWorkers, 10) : null,
            maleWorkers: row.maleWorkers ? parseInt(row.maleWorkers, 10) : null,
            femaleWorkers: row.femaleWorkers ? parseInt(row.femaleWorkers, 10) : null,
            pondCount: row.pondCount ? parseInt(row.pondCount, 10) : null,
            dataClassification: 'PARTNER',
            createdBy: user.userId,
            updatedBy: user.userId,
          },
        });

        await this.publishEvent(TOPIC_MS_FISHERIES_AQUACULTURE_FARM_CREATED, entity, user);
        result.imported++;
      } catch (err: any) {
        result.errors.push({ row: i + 2, field: 'general', message: err.message });
        result.skipped++;
      }
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Import: Aquaculture Production
  // ---------------------------------------------------------------------------

  async importProduction(buffer: Buffer, format: 'xlsx' | 'csv', user: AuthenticatedUser): Promise<ImportResult> {
    const rows = await this.parseFile(buffer, format);
    const result: ImportResult = { imported: 0, skipped: 0, errors: [] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        if (!row.farmId) {
          result.errors.push({ row: i + 2, field: 'farmId', message: 'Required' });
          result.skipped++;
          continue;
        }

        // Resolve speciesId from speciesCode if needed
        let speciesId = row.speciesId;
        if (!speciesId && row.speciesCode) {
          const species = await (this.prisma as any).species.findFirst({
            where: { faoAlphaCode: row.speciesCode },
          });
          if (!species) {
            const speciesByCode = await (this.prisma as any).species.findFirst({
              where: { code: row.speciesCode },
            });
            if (!speciesByCode) {
              result.errors.push({ row: i + 2, field: 'speciesCode', message: `Species not found: ${row.speciesCode}` });
              result.skipped++;
              continue;
            }
            speciesId = speciesByCode.id;
          } else {
            speciesId = species.id;
          }
        }

        if (!speciesId) {
          result.errors.push({ row: i + 2, field: 'speciesId/speciesCode', message: 'Required' });
          result.skipped++;
          continue;
        }

        if (!row.harvestDate) {
          result.errors.push({ row: i + 2, field: 'harvestDate', message: 'Required' });
          result.skipped++;
          continue;
        }

        // Verify farm exists
        const farm = await (this.prisma as any).aquacultureFarm.findUnique({
          where: { id: row.farmId },
        });
        if (!farm) {
          result.errors.push({ row: i + 2, field: 'farmId', message: `Farm not found: ${row.farmId}` });
          result.skipped++;
          continue;
        }

        const entity = await (this.prisma as any).aquacultureProduction.create({
          data: {
            tenantId: user.tenantId,
            farmId: row.farmId,
            speciesId,
            quantityKg: parseFloat(row.quantityKg) || 0,
            harvestDate: new Date(row.harvestDate),
            methodOfCulture: row.methodOfCulture ?? 'UNKNOWN',
            feedUsedKg: row.feedUsedKg ? parseFloat(row.feedUsedKg) : null,
            fcr: row.fcr ? parseFloat(row.fcr) : null,
            stockingDate: row.stockingDate ? new Date(row.stockingDate) : null,
            survivalRate: row.survivalRate ? parseFloat(row.survivalRate) : null,
            averageWeightGrams: row.averageWeightGrams ? parseFloat(row.averageWeightGrams) : null,
            dataClassification: 'PARTNER',
            createdBy: user.userId,
            updatedBy: user.userId,
          },
        });

        await this.publishEvent(TOPIC_MS_FISHERIES_AQUACULTURE_PRODUCTION_CREATED, entity, user);
        result.imported++;
      } catch (err: any) {
        result.errors.push({ row: i + 2, field: 'general', message: err.message });
        result.skipped++;
      }
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Import: Fishing Efforts
  // ---------------------------------------------------------------------------

  async importEfforts(buffer: Buffer, format: 'xlsx' | 'csv', user: AuthenticatedUser): Promise<ImportResult> {
    const rows = await this.parseFile(buffer, format);
    const result: ImportResult = { imported: 0, skipped: 0, errors: [] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        if (!row.effortType) {
          result.errors.push({ row: i + 2, field: 'effortType', message: 'Required' });
          result.skipped++;
          continue;
        }
        if (!row.effortValue && row.effortValue !== 0) {
          result.errors.push({ row: i + 2, field: 'effortValue', message: 'Required' });
          result.skipped++;
          continue;
        }
        if (!row.effortUnit) {
          result.errors.push({ row: i + 2, field: 'effortUnit', message: 'Required' });
          result.skipped++;
          continue;
        }

        const entity = await (this.prisma as any).fishingEffort.create({
          data: {
            tenantId: user.tenantId,
            effortType: row.effortType,
            effortValue: parseFloat(row.effortValue) || 0,
            effortUnit: row.effortUnit,
            startDate: row.startDate ? new Date(row.startDate) : null,
            endDate: row.endDate ? new Date(row.endDate) : null,
            gearType: row.gearType ?? 'UNKNOWN',
            vesselId: row.vesselId ?? null,
            crewSize: row.crewSize ? parseInt(row.crewSize, 10) : null,
            faoAreaCode: row.faoAreaCode ?? null,
            dataClassification: 'PARTNER',
            createdBy: user.userId,
            updatedBy: user.userId,
          },
        });

        await this.publishEvent(TOPIC_MS_FISHERIES_EFFORT_CREATED, entity, user);
        result.imported++;
      } catch (err: any) {
        result.errors.push({ row: i + 2, field: 'general', message: err.message });
        result.skipped++;
      }
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Kafka event publishing
  // ---------------------------------------------------------------------------

  private async publishEvent(topic: string, entity: any, user: AuthenticatedUser): Promise<void> {
    try {
      const headers: KafkaHeaders = {
        correlationId: uuidv4(),
        sourceService: SERVICE_NAME,
        tenantId: user.tenantId,
        userId: user.userId,
        schemaVersion: '1',
        timestamp: new Date().toISOString(),
      };
      await this.kafka.send(topic, entity.id, entity, headers);
    } catch {
      /* log but don't fail import on Kafka errors */
    }
  }

  // ---------------------------------------------------------------------------
  // Template generation
  // ---------------------------------------------------------------------------

  async getTemplate(entity: string): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Template');

    const templates: Record<string, string[]> = {
      captures: [
        'speciesCode', 'faoAreaCode', 'gearType', 'quantityKg', 'captureDate',
        'landingSite', 'fishingEnvironment', 'productionType', 'countryCode', 'vesselId',
      ],
      vessels: [
        'name', 'registrationNumber', 'flagState', 'vesselType', 'lengthMeters',
        'tonnageGt', 'homePort', 'enginePowerKw', 'crewCapacity', 'ownerName',
      ],
      farms: [
        'name', 'farmType', 'waterSource', 'areaHectares', 'productionCapacityTonnes',
        'countryCode', 'ownerName', 'totalWorkers', 'maleWorkers', 'femaleWorkers', 'pondCount',
      ],
      production: [
        'farmId', 'speciesCode', 'quantityKg', 'harvestDate', 'methodOfCulture',
        'feedUsedKg', 'fcr', 'stockingDate', 'survivalRate', 'averageWeightGrams',
      ],
      efforts: [
        'effortType', 'effortValue', 'effortUnit', 'startDate', 'endDate',
        'gearType', 'vesselId', 'crewSize', 'faoAreaCode',
      ],
    };

    const columns = templates[entity] || templates['captures'];
    sheet.columns = columns.map((h) => ({ header: h, key: h, width: 20 }));

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }
}

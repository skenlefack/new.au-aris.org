import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import { v4 as uuidv4 } from 'uuid';
import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import type { KafkaHeaders } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  TOPIC_MS_TRADE_FLOW_CREATED,
  TOPIC_MS_TRADE_PRICE_RECORDED,
} from '../kafka-topics.js';

interface ImportResult {
  imported: number;
  skipped: number;
  errors: Array<{ row: number; field: string; message: string }>;
}

const SERVICE_NAME = 'trade-sps-service';

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
  // Import: Trade Flows
  // ---------------------------------------------------------------------------

  async importTradeFlows(buffer: Buffer, format: 'xlsx' | 'csv', user: AuthenticatedUser): Promise<ImportResult> {
    const rows = await this.parseFile(buffer, format);
    const result: ImportResult = { imported: 0, skipped: 0, errors: [] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        // Validate required fields
        if (!row.commodity) {
          result.errors.push({ row: i + 2, field: 'commodity', message: 'Required' });
          result.skipped++;
          continue;
        }
        if (!row.flowDirection) {
          result.errors.push({ row: i + 2, field: 'flowDirection', message: 'Required' });
          result.skipped++;
          continue;
        }

        // Resolve exportCountryId from exportCountryCode if needed
        let exportCountryId = row.exportCountryId;
        if (!exportCountryId && row.exportCountryCode) {
          const geo = await (this.prisma as any).geoEntity.findFirst({
            where: { code: row.exportCountryCode },
          });
          exportCountryId = geo?.id ?? null;
        }

        // Resolve importCountryId from importCountryCode if needed
        let importCountryId = row.importCountryId;
        if (!importCountryId && row.importCountryCode) {
          const geo = await (this.prisma as any).geoEntity.findFirst({
            where: { code: row.importCountryCode },
          });
          importCountryId = geo?.id ?? null;
        }

        // Resolve speciesId from speciesCode if needed
        let speciesId = row.speciesId;
        if (!speciesId && row.speciesCode) {
          const species = await (this.prisma as any).species.findFirst({
            where: { code: row.speciesCode },
          });
          if (!species) {
            result.errors.push({ row: i + 2, field: 'speciesCode', message: `Species not found: ${row.speciesCode}` });
            result.skipped++;
            continue;
          }
          speciesId = species.id;
        }

        const entity = await (this.prisma as any).tradeFlow.create({
          data: {
            tenantId: user.tenantId,
            exportCountryId: exportCountryId ?? null,
            importCountryId: importCountryId ?? null,
            speciesId: speciesId ?? null,
            commodity: row.commodity,
            flowDirection: row.flowDirection,
            quantity: parseFloat(row.quantity) || 0,
            unit: row.unit ?? 'KG',
            valueFob: row.valueFob ? parseFloat(row.valueFob) : null,
            currency: row.currency ?? 'USD',
            periodStart: row.periodStart ? new Date(row.periodStart) : null,
            periodEnd: row.periodEnd ? new Date(row.periodEnd) : null,
            hsCode: row.hsCode ?? null,
            spsStatus: row.spsStatus ?? null,
            productState: row.productState ?? null,
            commodityGroup: row.commodityGroup ?? null,
            processingLevel: row.processingLevel ?? null,
            dataClassification: 'PARTNER',
            createdBy: user.userId,
            updatedBy: user.userId,
          },
        });

        await this.publishEvent(TOPIC_MS_TRADE_FLOW_CREATED, entity, user);
        result.imported++;
      } catch (err: any) {
        result.errors.push({ row: i + 2, field: 'general', message: err.message });
        result.skipped++;
      }
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Import: Market Prices
  // ---------------------------------------------------------------------------

  async importMarketPrices(buffer: Buffer, format: 'xlsx' | 'csv', user: AuthenticatedUser): Promise<ImportResult> {
    const rows = await this.parseFile(buffer, format);
    const result: ImportResult = { imported: 0, skipped: 0, errors: [] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        if (!row.commodity) {
          result.errors.push({ row: i + 2, field: 'commodity', message: 'Required' });
          result.skipped++;
          continue;
        }
        if (!row.price && row.price !== 0) {
          result.errors.push({ row: i + 2, field: 'price', message: 'Required' });
          result.skipped++;
          continue;
        }

        // Resolve speciesId from speciesCode if needed
        let speciesId = row.speciesId;
        if (!speciesId && row.speciesCode) {
          const species = await (this.prisma as any).species.findFirst({
            where: { code: row.speciesCode },
          });
          if (species) {
            speciesId = species.id;
          }
        }

        const entity = await (this.prisma as any).marketPrice.create({
          data: {
            tenantId: user.tenantId,
            marketId: row.marketId ?? null,
            speciesId: speciesId ?? null,
            commodity: row.commodity,
            priceType: row.priceType ?? 'WHOLESALE',
            price: parseFloat(row.price) || 0,
            currency: row.currency ?? 'USD',
            unit: row.unit ?? 'KG',
            date: row.date ? new Date(row.date) : new Date(),
            source: row.source ?? null,
            dataClassification: 'PUBLIC',
            createdBy: user.userId,
            updatedBy: user.userId,
          },
        });

        await this.publishEvent(TOPIC_MS_TRADE_PRICE_RECORDED, entity, user);
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
      flows: [
        'exportCountryCode', 'importCountryCode', 'speciesCode', 'commodity',
        'flowDirection', 'quantity', 'unit', 'valueFob', 'currency',
        'periodStart', 'periodEnd', 'hsCode', 'spsStatus', 'productState',
        'commodityGroup', 'processingLevel',
      ],
      'market-prices': [
        'marketId', 'speciesCode', 'commodity', 'priceType', 'price',
        'currency', 'unit', 'date', 'source',
      ],
    };

    const columns = templates[entity] || templates['flows'];
    sheet.columns = columns.map((h) => ({ header: h, key: h, width: 20 }));

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }
}

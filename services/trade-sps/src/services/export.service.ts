import ExcelJS from 'exceljs';
import type { PrismaClient } from '@prisma/client';
import { TenantLevel } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

export interface TradeExportFilters {
  tenantId?: string;
  year?: number;
  speciesId?: string;
  commodityGroup?: string;
  flowDirection?: string;
  status?: string;
  originCountryId?: string;
  destinationCountryId?: string;
  marketId?: string;
  priceType?: string;
}

export class ExportService {
  constructor(private readonly prisma: PrismaClient) {}

  // ─── Trade Flows ─────────────────────────────────────────────────────

  async exportTradeFlows(
    filters: TradeExportFilters,
    format: 'xlsx' | 'csv',
    user: AuthenticatedUser,
  ): Promise<Buffer> {
    const where = this.buildTenantWhere(user);

    if (filters.year) {
      const start = new Date(`${filters.year}-01-01`);
      const end = new Date(`${filters.year + 1}-01-01`);
      where['periodStart'] = { gte: start, lt: end };
    }
    if (filters.speciesId) where['speciesId'] = filters.speciesId;
    if (filters.commodityGroup) where['commodityGroup'] = filters.commodityGroup;
    if (filters.flowDirection) where['flowDirection'] = filters.flowDirection;

    const data = await (this.prisma as any).tradeFlow.findMany({
      where,
      take: 10000,
      orderBy: { createdAt: 'desc' },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Trade Flows');

    sheet.columns = [
      { header: 'ID', key: 'id', width: 36 },
      { header: 'Export Country ID', key: 'exportCountryId', width: 36 },
      { header: 'Import Country ID', key: 'importCountryId', width: 36 },
      { header: 'Species ID', key: 'speciesId', width: 36 },
      { header: 'Commodity', key: 'commodity', width: 25 },
      { header: 'Commodity Group', key: 'commodityGroup', width: 20 },
      { header: 'Flow Direction', key: 'flowDirection', width: 15 },
      { header: 'Quantity', key: 'quantity', width: 14 },
      { header: 'Unit', key: 'unit', width: 10 },
      { header: 'Value FOB', key: 'valueFob', width: 14 },
      { header: 'Currency', key: 'currency', width: 10 },
      { header: 'Period Start', key: 'periodStart', width: 20 },
      { header: 'Period End', key: 'periodEnd', width: 20 },
      { header: 'HS Code', key: 'hsCode', width: 15 },
      { header: 'SPS Status', key: 'spsStatus', width: 15 },
      { header: 'Product State', key: 'productState', width: 15 },
      { header: 'Processing Level', key: 'processingLevel', width: 18 },
      { header: 'Tenant ID', key: 'tenantId', width: 36 },
      { header: 'Created At', key: 'createdAt', width: 22 },
    ];

    this.styleHeaderRow(sheet);

    for (const row of data) {
      sheet.addRow({
        id: row.id,
        exportCountryId: row.exportCountryId,
        importCountryId: row.importCountryId,
        speciesId: row.speciesId,
        commodity: row.commodity,
        commodityGroup: row.commodityGroup,
        flowDirection: row.flowDirection,
        quantity: row.quantity != null ? Number(row.quantity) : null,
        unit: row.unit,
        valueFob: row.valueFob != null ? Number(row.valueFob) : null,
        currency: row.currency,
        periodStart: row.periodStart?.toISOString?.() ?? row.periodStart,
        periodEnd: row.periodEnd?.toISOString?.() ?? row.periodEnd,
        hsCode: row.hsCode,
        spsStatus: row.spsStatus,
        productState: row.productState,
        processingLevel: row.processingLevel,
        tenantId: row.tenantId,
        createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
      });
    }

    return this.writeBuffer(workbook, format);
  }

  // ─── SPS Certificates ───────────────────────────────────────────────

  async exportSpsCertificates(
    filters: TradeExportFilters,
    format: 'xlsx' | 'csv',
    user: AuthenticatedUser,
  ): Promise<Buffer> {
    const where = this.buildTenantWhere(user);

    if (filters.year) {
      const start = new Date(`${filters.year}-01-01`);
      const end = new Date(`${filters.year + 1}-01-01`);
      where['inspectionDate'] = { gte: start, lt: end };
    }
    if (filters.speciesId) where['speciesId'] = filters.speciesId;
    if (filters.status) where['status'] = filters.status;
    if (filters.originCountryId) where['originCountryId'] = filters.originCountryId;
    if (filters.destinationCountryId) where['destinationCountryId'] = filters.destinationCountryId;

    const data = await (this.prisma as any).spsCertificate.findMany({
      where,
      take: 10000,
      orderBy: { createdAt: 'desc' },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('SPS Certificates');

    sheet.columns = [
      { header: 'ID', key: 'id', width: 36 },
      { header: 'Certificate Number', key: 'certificateNumber', width: 22 },
      { header: 'Consignment ID', key: 'consignmentId', width: 22 },
      { header: 'Exporter ID', key: 'exporterId', width: 36 },
      { header: 'Importer ID', key: 'importerId', width: 36 },
      { header: 'Species ID', key: 'speciesId', width: 36 },
      { header: 'Commodity', key: 'commodity', width: 25 },
      { header: 'Quantity', key: 'quantity', width: 14 },
      { header: 'Unit', key: 'unit', width: 10 },
      { header: 'Origin Country ID', key: 'originCountryId', width: 36 },
      { header: 'Destination Country ID', key: 'destinationCountryId', width: 36 },
      { header: 'Inspection Result', key: 'inspectionResult', width: 18 },
      { header: 'Inspection Date', key: 'inspectionDate', width: 20 },
      { header: 'Certified By', key: 'certifiedBy', width: 36 },
      { header: 'Certified At', key: 'certifiedAt', width: 22 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Valid Until', key: 'validUntil', width: 20 },
      { header: 'Remarks', key: 'remarks', width: 30 },
      { header: 'Tenant ID', key: 'tenantId', width: 36 },
      { header: 'Created At', key: 'createdAt', width: 22 },
    ];

    this.styleHeaderRow(sheet);

    for (const row of data) {
      sheet.addRow({
        id: row.id,
        certificateNumber: row.certificateNumber,
        consignmentId: row.consignmentId,
        exporterId: row.exporterId,
        importerId: row.importerId,
        speciesId: row.speciesId,
        commodity: row.commodity,
        quantity: row.quantity != null ? Number(row.quantity) : null,
        unit: row.unit,
        originCountryId: row.originCountryId,
        destinationCountryId: row.destinationCountryId,
        inspectionResult: row.inspectionResult,
        inspectionDate: row.inspectionDate?.toISOString?.() ?? row.inspectionDate,
        certifiedBy: row.certifiedBy,
        certifiedAt: row.certifiedAt?.toISOString?.() ?? row.certifiedAt,
        status: row.status,
        validUntil: row.validUntil?.toISOString?.() ?? row.validUntil,
        remarks: row.remarks,
        tenantId: row.tenantId,
        createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
      });
    }

    return this.writeBuffer(workbook, format);
  }

  // ─── Market Prices ──────────────────────────────────────────────────

  async exportMarketPrices(
    filters: TradeExportFilters,
    format: 'xlsx' | 'csv',
    user: AuthenticatedUser,
  ): Promise<Buffer> {
    const where = this.buildTenantWhere(user);

    if (filters.year) {
      const start = new Date(`${filters.year}-01-01`);
      const end = new Date(`${filters.year + 1}-01-01`);
      where['date'] = { gte: start, lt: end };
    }
    if (filters.speciesId) where['speciesId'] = filters.speciesId;
    if (filters.marketId) where['marketId'] = filters.marketId;
    if (filters.priceType) where['priceType'] = filters.priceType;

    const data = await (this.prisma as any).marketPrice.findMany({
      where,
      take: 10000,
      orderBy: { createdAt: 'desc' },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Market Prices');

    sheet.columns = [
      { header: 'ID', key: 'id', width: 36 },
      { header: 'Market ID', key: 'marketId', width: 36 },
      { header: 'Species ID', key: 'speciesId', width: 36 },
      { header: 'Commodity', key: 'commodity', width: 25 },
      { header: 'Price Type', key: 'priceType', width: 15 },
      { header: 'Price', key: 'price', width: 14 },
      { header: 'Currency', key: 'currency', width: 10 },
      { header: 'Unit', key: 'unit', width: 10 },
      { header: 'Date', key: 'date', width: 20 },
      { header: 'Source', key: 'source', width: 25 },
      { header: 'Tenant ID', key: 'tenantId', width: 36 },
      { header: 'Created At', key: 'createdAt', width: 22 },
    ];

    this.styleHeaderRow(sheet);

    for (const row of data) {
      sheet.addRow({
        id: row.id,
        marketId: row.marketId,
        speciesId: row.speciesId,
        commodity: row.commodity,
        priceType: row.priceType,
        price: row.price != null ? Number(row.price) : null,
        currency: row.currency,
        unit: row.unit,
        date: row.date?.toISOString?.() ?? row.date,
        source: row.source,
        tenantId: row.tenantId,
        createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
      });
    }

    return this.writeBuffer(workbook, format);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────

  private buildTenantWhere(user: AuthenticatedUser): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (user.tenantLevel === TenantLevel.MEMBER_STATE) {
      where['tenantId'] = user.tenantId;
    } else if (user.tenantLevel === TenantLevel.REC) {
      where['tenantId'] = user.tenantId;
    }
    // CONTINENTAL: no tenant filter

    return where;
  }

  private styleHeaderRow(sheet: ExcelJS.Worksheet): void {
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.alignment = { horizontal: 'center' };
  }

  private async writeBuffer(
    workbook: ExcelJS.Workbook,
    format: 'xlsx' | 'csv',
  ): Promise<Buffer> {
    if (format === 'csv') {
      return Buffer.from(await workbook.csv.writeBuffer());
    }
    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }
}

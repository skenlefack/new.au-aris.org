import ExcelJS from 'exceljs';
import type { PrismaClient } from '@prisma/client';
import { TenantLevel } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

export interface ExportFilters {
  tenantId?: string;
  year?: number;
  speciesId?: string;
  faoAreaCode?: string;
  status?: string;
}

export class ExportService {
  constructor(private readonly prisma: PrismaClient) {}

  // ─── Captures ────────────────────────────────────────────────────────

  async exportCaptures(
    filters: ExportFilters,
    format: 'xlsx' | 'csv',
    user: AuthenticatedUser,
  ): Promise<Buffer> {
    const where = this.buildTenantWhere(user);

    if (filters.year) {
      const start = new Date(`${filters.year}-01-01`);
      const end = new Date(`${filters.year + 1}-01-01`);
      where['captureDate'] = { gte: start, lt: end };
    }
    if (filters.speciesId) where['speciesId'] = filters.speciesId;
    if (filters.faoAreaCode) where['faoAreaCode'] = filters.faoAreaCode;
    if (filters.status) where['status'] = filters.status;

    const data = await (this.prisma as any).fishCapture.findMany({
      where,
      take: 10000,
      orderBy: { createdAt: 'desc' },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Captures');

    sheet.columns = [
      { header: 'ID', key: 'id', width: 36 },
      { header: 'Species ID', key: 'speciesId', width: 36 },
      { header: 'FAO Area', key: 'faoAreaCode', width: 15 },
      { header: 'Gear Type', key: 'gearType', width: 20 },
      { header: 'Quantity (kg)', key: 'quantityKg', width: 15 },
      { header: 'Landing Site', key: 'landingSite', width: 25 },
      { header: 'Capture Date', key: 'captureDate', width: 20 },
      { header: 'Fishing Environment', key: 'fishingEnvironment', width: 20 },
      { header: 'Production Type', key: 'productionType', width: 20 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Tenant ID', key: 'tenantId', width: 36 },
      { header: 'Created At', key: 'createdAt', width: 22 },
    ];

    this.styleHeaderRow(sheet);

    for (const row of data) {
      sheet.addRow({
        id: row.id,
        speciesId: row.speciesId,
        faoAreaCode: row.faoAreaCode,
        gearType: row.gearType,
        quantityKg: row.quantityKg != null ? Number(row.quantityKg) : null,
        landingSite: row.landingSite,
        captureDate: row.captureDate?.toISOString?.() ?? row.captureDate,
        fishingEnvironment: row.fishingEnvironment,
        productionType: row.productionType,
        status: row.status,
        tenantId: row.tenantId,
        createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
      });
    }

    return this.writeBuffer(workbook, format);
  }

  // ─── Vessels ─────────────────────────────────────────────────────────

  async exportVessels(
    filters: ExportFilters,
    format: 'xlsx' | 'csv',
    user: AuthenticatedUser,
  ): Promise<Buffer> {
    const where = this.buildTenantWhere(user);

    if (filters.status) where['isActive'] = filters.status === 'active';

    const data = await (this.prisma as any).fishingVessel.findMany({
      where,
      take: 10000,
      orderBy: { createdAt: 'desc' },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Vessels');

    sheet.columns = [
      { header: 'ID', key: 'id', width: 36 },
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Registration Number', key: 'registrationNumber', width: 22 },
      { header: 'Flag State', key: 'flagState', width: 15 },
      { header: 'Vessel Type', key: 'vesselType', width: 20 },
      { header: 'Length (m)', key: 'lengthMeters', width: 12 },
      { header: 'Tonnage (GT)', key: 'tonnageGt', width: 14 },
      { header: 'Home Port', key: 'homePort', width: 20 },
      { header: 'License Number', key: 'licenseNumber', width: 20 },
      { header: 'License Expiry', key: 'licenseExpiry', width: 20 },
      { header: 'Engine Power (kW)', key: 'enginePowerKw', width: 18 },
      { header: 'Crew Capacity', key: 'crewCapacity', width: 14 },
      { header: 'Owner Name', key: 'ownerName', width: 25 },
      { header: 'Active', key: 'isActive', width: 10 },
      { header: 'Tenant ID', key: 'tenantId', width: 36 },
      { header: 'Created At', key: 'createdAt', width: 22 },
    ];

    this.styleHeaderRow(sheet);

    for (const row of data) {
      sheet.addRow({
        id: row.id,
        name: row.name,
        registrationNumber: row.registrationNumber,
        flagState: row.flagState,
        vesselType: row.vesselType,
        lengthMeters: row.lengthMeters != null ? Number(row.lengthMeters) : null,
        tonnageGt: row.tonnageGt != null ? Number(row.tonnageGt) : null,
        homePort: row.homePort,
        licenseNumber: row.licenseNumber,
        licenseExpiry: row.licenseExpiry?.toISOString?.() ?? row.licenseExpiry,
        enginePowerKw: row.enginePowerKw != null ? Number(row.enginePowerKw) : null,
        crewCapacity: row.crewCapacity,
        ownerName: row.ownerName,
        isActive: row.isActive,
        tenantId: row.tenantId,
        createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
      });
    }

    return this.writeBuffer(workbook, format);
  }

  // ─── Aquaculture Farms ───────────────────────────────────────────────

  async exportFarms(
    filters: ExportFilters,
    format: 'xlsx' | 'csv',
    user: AuthenticatedUser,
  ): Promise<Buffer> {
    const where = this.buildTenantWhere(user);

    const data = await (this.prisma as any).aquacultureFarm.findMany({
      where,
      take: 10000,
      orderBy: { createdAt: 'desc' },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Aquaculture Farms');

    sheet.columns = [
      { header: 'ID', key: 'id', width: 36 },
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Farm Type', key: 'farmType', width: 20 },
      { header: 'Water Source', key: 'waterSource', width: 20 },
      { header: 'Area (ha)', key: 'areaHectares', width: 12 },
      { header: 'Production Capacity (t)', key: 'productionCapacityTonnes', width: 24 },
      { header: 'Owner Name', key: 'ownerName', width: 25 },
      { header: 'Registration Number', key: 'registrationNumber', width: 22 },
      { header: 'Total Workers', key: 'totalWorkers', width: 14 },
      { header: 'Male Workers', key: 'maleWorkers', width: 14 },
      { header: 'Female Workers', key: 'femaleWorkers', width: 14 },
      { header: 'Pond Count', key: 'pondCount', width: 12 },
      { header: 'Active', key: 'isActive', width: 10 },
      { header: 'Tenant ID', key: 'tenantId', width: 36 },
      { header: 'Created At', key: 'createdAt', width: 22 },
    ];

    this.styleHeaderRow(sheet);

    for (const row of data) {
      sheet.addRow({
        id: row.id,
        name: row.name,
        farmType: row.farmType,
        waterSource: row.waterSource,
        areaHectares: row.areaHectares != null ? Number(row.areaHectares) : null,
        productionCapacityTonnes: row.productionCapacityTonnes != null ? Number(row.productionCapacityTonnes) : null,
        ownerName: row.ownerName,
        registrationNumber: row.registrationNumber,
        totalWorkers: row.totalWorkers,
        maleWorkers: row.maleWorkers,
        femaleWorkers: row.femaleWorkers,
        pondCount: row.pondCount,
        isActive: row.isActive,
        tenantId: row.tenantId,
        createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
      });
    }

    return this.writeBuffer(workbook, format);
  }

  // ─── Aquaculture Production ──────────────────────────────────────────

  async exportProduction(
    filters: ExportFilters,
    format: 'xlsx' | 'csv',
    user: AuthenticatedUser,
  ): Promise<Buffer> {
    const where = this.buildTenantWhere(user);

    if (filters.year) {
      const start = new Date(`${filters.year}-01-01`);
      const end = new Date(`${filters.year + 1}-01-01`);
      where['harvestDate'] = { gte: start, lt: end };
    }
    if (filters.speciesId) where['speciesId'] = filters.speciesId;

    const data = await (this.prisma as any).aquacultureProduction.findMany({
      where,
      take: 10000,
      orderBy: { createdAt: 'desc' },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Aquaculture Production');

    sheet.columns = [
      { header: 'ID', key: 'id', width: 36 },
      { header: 'Farm ID', key: 'farmId', width: 36 },
      { header: 'Species ID', key: 'speciesId', width: 36 },
      { header: 'Quantity (kg)', key: 'quantityKg', width: 15 },
      { header: 'Harvest Date', key: 'harvestDate', width: 20 },
      { header: 'Method of Culture', key: 'methodOfCulture', width: 20 },
      { header: 'Feed Used (kg)', key: 'feedUsedKg', width: 15 },
      { header: 'FCR', key: 'fcr', width: 10 },
      { header: 'Batch ID', key: 'batchId', width: 20 },
      { header: 'Stocking Date', key: 'stockingDate', width: 20 },
      { header: 'Survival Rate', key: 'survivalRate', width: 14 },
      { header: 'Avg Weight (g)', key: 'averageWeightGrams', width: 16 },
      { header: 'Tenant ID', key: 'tenantId', width: 36 },
      { header: 'Created At', key: 'createdAt', width: 22 },
    ];

    this.styleHeaderRow(sheet);

    for (const row of data) {
      sheet.addRow({
        id: row.id,
        farmId: row.farmId,
        speciesId: row.speciesId,
        quantityKg: row.quantityKg != null ? Number(row.quantityKg) : null,
        harvestDate: row.harvestDate?.toISOString?.() ?? row.harvestDate,
        methodOfCulture: row.methodOfCulture,
        feedUsedKg: row.feedUsedKg != null ? Number(row.feedUsedKg) : null,
        fcr: row.fcr != null ? Number(row.fcr) : null,
        batchId: row.batchId,
        stockingDate: row.stockingDate?.toISOString?.() ?? row.stockingDate,
        survivalRate: row.survivalRate != null ? Number(row.survivalRate) : null,
        averageWeightGrams: row.averageWeightGrams != null ? Number(row.averageWeightGrams) : null,
        tenantId: row.tenantId,
        createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
      });
    }

    return this.writeBuffer(workbook, format);
  }

  // ─── Fishing Efforts ─────────────────────────────────────────────────

  async exportEfforts(
    filters: ExportFilters,
    format: 'xlsx' | 'csv',
    user: AuthenticatedUser,
  ): Promise<Buffer> {
    const where = this.buildTenantWhere(user);

    if (filters.year) {
      const start = new Date(`${filters.year}-01-01`);
      const end = new Date(`${filters.year + 1}-01-01`);
      where['startDate'] = { gte: start, lt: end };
    }
    if (filters.faoAreaCode) where['faoAreaCode'] = filters.faoAreaCode;

    const data = await (this.prisma as any).fishingEffort.findMany({
      where,
      take: 10000,
      orderBy: { createdAt: 'desc' },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Fishing Efforts');

    sheet.columns = [
      { header: 'ID', key: 'id', width: 36 },
      { header: 'Effort Type', key: 'effortType', width: 20 },
      { header: 'Effort Value', key: 'effortValue', width: 14 },
      { header: 'Effort Unit', key: 'effortUnit', width: 15 },
      { header: 'Start Date', key: 'startDate', width: 20 },
      { header: 'End Date', key: 'endDate', width: 20 },
      { header: 'Gear Type', key: 'gearType', width: 20 },
      { header: 'Vessel ID', key: 'vesselId', width: 36 },
      { header: 'Capture ID', key: 'captureId', width: 36 },
      { header: 'Crew Size', key: 'crewSize', width: 12 },
      { header: 'FAO Area', key: 'faoAreaCode', width: 15 },
      { header: 'Tenant ID', key: 'tenantId', width: 36 },
      { header: 'Created At', key: 'createdAt', width: 22 },
    ];

    this.styleHeaderRow(sheet);

    for (const row of data) {
      sheet.addRow({
        id: row.id,
        effortType: row.effortType,
        effortValue: row.effortValue != null ? Number(row.effortValue) : null,
        effortUnit: row.effortUnit,
        startDate: row.startDate?.toISOString?.() ?? row.startDate,
        endDate: row.endDate?.toISOString?.() ?? row.endDate,
        gearType: row.gearType,
        vesselId: row.vesselId,
        captureId: row.captureId,
        crewSize: row.crewSize,
        faoAreaCode: row.faoAreaCode,
        tenantId: row.tenantId,
        createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
      });
    }

    return this.writeBuffer(workbook, format);
  }

  // ─── FishStatJ Export ────────────────────────────────────────────────

  async exportFishStatJ(
    year: number,
    user: AuthenticatedUser,
  ): Promise<Buffer> {
    const tenantWhere = this.buildTenantWhere(user);

    const yearStart = new Date(`${year}-01-01`);
    const yearEnd = new Date(`${year + 1}-01-01`);

    // Query captures for the given year
    const captures = await (this.prisma as any).fishCapture.findMany({
      where: {
        ...tenantWhere,
        captureDate: { gte: yearStart, lt: yearEnd },
      },
      select: {
        tenantId: true,
        speciesId: true,
        faoAreaCode: true,
        quantityKg: true,
        fishingEnvironment: true,
      },
    });

    // Query aquaculture production for the given year
    const aquaProduction = await (this.prisma as any).aquacultureProduction.findMany({
      where: {
        ...tenantWhere,
        harvestDate: { gte: yearStart, lt: yearEnd },
      },
      select: {
        tenantId: true,
        speciesId: true,
        quantityKg: true,
      },
    });

    // Aggregate captures by country + species + FAO area
    const captureAgg = new Map<string, { tenantId: string; speciesId: string; faoAreaCode: string; totalKg: number }>();
    for (const c of captures) {
      const key = `${c.tenantId}|${c.speciesId}|${c.faoAreaCode ?? 'UNKNOWN'}`;
      const existing = captureAgg.get(key);
      if (existing) {
        existing.totalKg += Number(c.quantityKg ?? 0);
      } else {
        captureAgg.set(key, {
          tenantId: c.tenantId,
          speciesId: c.speciesId,
          faoAreaCode: c.faoAreaCode ?? 'UNKNOWN',
          totalKg: Number(c.quantityKg ?? 0),
        });
      }
    }

    // Aggregate aquaculture production by country + species
    const aquaAgg = new Map<string, { tenantId: string; speciesId: string; totalKg: number }>();
    for (const a of aquaProduction) {
      const key = `${a.tenantId}|${a.speciesId}`;
      const existing = aquaAgg.get(key);
      if (existing) {
        existing.totalKg += Number(a.quantityKg ?? 0);
      } else {
        aquaAgg.set(key, {
          tenantId: a.tenantId,
          speciesId: a.speciesId,
          totalKg: Number(a.quantityKg ?? 0),
        });
      }
    }

    // Build FishStatJ CSV format
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('FishStatJ');

    const yearColumn = `Year_${year}`;
    sheet.columns = [
      { header: 'Country', key: 'country', width: 36 },
      { header: 'ISSCAAP_Group', key: 'isscaapGroup', width: 20 },
      { header: 'Species_Scientific', key: 'speciesScientific', width: 30 },
      { header: 'Species_FAO_Code', key: 'speciesFaoCode', width: 20 },
      { header: 'FAO_Area', key: 'faoArea', width: 15 },
      { header: 'Production_Source', key: 'productionSource', width: 20 },
      { header: 'Unit', key: 'unit', width: 10 },
      { header: yearColumn, key: 'yearValue', width: 15 },
    ];

    this.styleHeaderRow(sheet);

    // Add capture rows (production source = Capture)
    for (const agg of captureAgg.values()) {
      sheet.addRow({
        country: agg.tenantId,
        isscaapGroup: '',
        speciesScientific: '',
        speciesFaoCode: agg.speciesId,
        faoArea: agg.faoAreaCode,
        productionSource: 'Capture',
        unit: 't',
        yearValue: Math.round((agg.totalKg / 1000) * 100) / 100,
      });
    }

    // Add aquaculture rows (production source = Aquaculture)
    for (const agg of aquaAgg.values()) {
      sheet.addRow({
        country: agg.tenantId,
        isscaapGroup: '',
        speciesScientific: '',
        speciesFaoCode: agg.speciesId,
        faoArea: '',
        productionSource: 'Aquaculture',
        unit: 't',
        yearValue: Math.round((agg.totalKg / 1000) * 100) / 100,
      });
    }

    // FishStatJ is always CSV
    return Buffer.from(await workbook.csv.writeBuffer());
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

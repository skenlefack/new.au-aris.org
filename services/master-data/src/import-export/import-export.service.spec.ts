import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { ImportExportService } from './import-export.service';
import { ReferentialType } from './dto/import-export.dto';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { UserRole, TenantLevel } from '@aris/shared-types';

const mockUser: AuthenticatedUser = {
  userId: '00000000-0000-0000-0000-000000000001',
  email: 'admin@au-ibar.org',
  role: UserRole.CONTINENTAL_ADMIN,
  tenantId: '00000000-0000-0000-0000-000000000010',
  tenantLevel: TenantLevel.CONTINENTAL,
};

describe('ImportExportService', () => {
  let service: ImportExportService;
  let prisma: Record<string, Record<string, ReturnType<typeof vi.fn>>>;
  let audit: { log: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    prisma = {
      geoEntity: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      species: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      disease: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      unit: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      identifier: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      denominator: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    };
    audit = { log: vi.fn() };

    // Direct instantiation bypasses NestJS DI mock injection issues
    service = new ImportExportService(prisma as any, audit as any);
  });

  describe('importCsv — geo_entities', () => {
    it('should create new geo entities from CSV', async () => {
      const csv = 'code,name,name_en,name_fr,level,country_code\nTZ,Tanzania,Tanzania,Tanzanie,COUNTRY,TZ';
      prisma.geoEntity.findUnique.mockResolvedValue(null);
      prisma.geoEntity.create.mockResolvedValue({ id: 'new-id', code: 'TZ' });

      const result = await service.importCsv(ReferentialType.GEO_ENTITIES, csv, mockUser);

      expect(result.data.created).toBe(1);
      expect(result.data.updated).toBe(0);
      expect(result.data.errors).toBe(0);
      expect(prisma.geoEntity.create).toHaveBeenCalledOnce();
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'CREATE' }));
    });

    it('should update existing geo entities', async () => {
      const csv = 'code,name,name_en,name_fr,level,country_code\nKE,Kenya,Kenya,Kenya,COUNTRY,KE';
      prisma.geoEntity.findUnique.mockResolvedValue({ id: 'existing-id', code: 'KE' });
      prisma.geoEntity.update.mockResolvedValue({ id: 'existing-id', code: 'KE' });

      const result = await service.importCsv(ReferentialType.GEO_ENTITIES, csv, mockUser);

      expect(result.data.updated).toBe(1);
      expect(result.data.created).toBe(0);
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'UPDATE' }));
    });

    it('should skip rows with missing required fields', async () => {
      const csv = 'code,name,name_en,name_fr,level,country_code\n,,,,,';

      const result = await service.importCsv(ReferentialType.GEO_ENTITIES, csv, mockUser);

      expect(result.data.skipped).toBe(1);
      expect(result.data.details[0].error).toContain('Missing required field');
    });

    it('should skip rows with invalid level', async () => {
      const csv = 'code,name,name_en,name_fr,level,country_code\nKE,Kenya,Kenya,Kenya,INVALID,KE';

      const result = await service.importCsv(ReferentialType.GEO_ENTITIES, csv, mockUser);

      expect(result.data.skipped).toBe(1);
      expect(result.data.details[0].error).toContain('Invalid level');
    });

    it('should report mixed results for multi-row CSV', async () => {
      const csv = [
        'code,name,name_en,name_fr,level,country_code',
        'TZ,Tanzania,Tanzania,Tanzanie,COUNTRY,TZ',
        ',,,,,',
        'KE,Kenya,Kenya,Kenya,COUNTRY,KE',
      ].join('\n');

      prisma.geoEntity.findUnique
        .mockResolvedValueOnce(null) // TZ doesn't exist
        .mockResolvedValueOnce({ id: 'ke-id', code: 'KE' }); // KE exists
      prisma.geoEntity.create.mockResolvedValue({ id: 'tz-id', code: 'TZ' });
      prisma.geoEntity.update.mockResolvedValue({ id: 'ke-id', code: 'KE' });

      const result = await service.importCsv(ReferentialType.GEO_ENTITIES, csv, mockUser);

      expect(result.data.totalRows).toBe(3);
      expect(result.data.created).toBe(1);
      expect(result.data.updated).toBe(1);
      expect(result.data.skipped).toBe(1);
    });
  });

  describe('importCsv — species', () => {
    it('should create new species from CSV', async () => {
      const csv = 'code,scientific_name,common_name_en,common_name_fr,category,production_categories,is_woah_listed\nBOS-TAU,Bos taurus,Cattle,Bovin,DOMESTIC,dairy;beef,true';
      prisma.species.findUnique.mockResolvedValue(null);
      prisma.species.create.mockResolvedValue({ id: 'sp-id', code: 'BOS-TAU' });

      const result = await service.importCsv(ReferentialType.SPECIES, csv, mockUser);

      expect(result.data.created).toBe(1);
      expect(prisma.species.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            productionCategories: ['dairy', 'beef'],
            isWoahListed: true,
          }),
        }),
      );
    });
  });

  describe('importCsv — denominators', () => {
    it('should create new denominators from CSV', async () => {
      const csv = 'country_code,species_code,year,source,population,assumptions\nKE,BOS-TAU,2024,FAOSTAT,19800000,FAOSTAT 2024';
      prisma.species.findUnique.mockResolvedValue({ id: 'sp-id', code: 'BOS-TAU' });
      prisma.geoEntity.findUnique.mockResolvedValue({ id: 'geo-id', code: 'KE' });
      prisma.denominator.findFirst.mockResolvedValue(null);
      prisma.denominator.create.mockResolvedValue({ id: 'den-id' });

      const result = await service.importCsv(ReferentialType.DENOMINATORS, csv, mockUser);

      expect(result.data.created).toBe(1);
      expect(prisma.denominator.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            population: BigInt(19800000),
            source: 'FAOSTAT',
          }),
        }),
      );
    });

    it('should skip denominator if species not found', async () => {
      const csv = 'country_code,species_code,year,source,population\nKE,UNKNOWN,2024,FAOSTAT,100';
      prisma.species.findUnique.mockResolvedValue(null);

      const result = await service.importCsv(ReferentialType.DENOMINATORS, csv, mockUser);

      expect(result.data.skipped).toBe(1);
      expect(result.data.details[0].error).toContain('Species');
    });
  });

  describe('importCsv — error handling', () => {
    it('should throw for completely unparseable CSV', async () => {
      await expect(
        service.importCsv(ReferentialType.GEO_ENTITIES, '', mockUser),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('importFaostat', () => {
    it('should import FAOSTAT format CSV', async () => {
      const csv = 'Area Code,Area,Item Code,Item,Element,Year,Unit,Value\nKE,Kenya,866,Cattle,Stocks,2024,Head,"19,800,000"';
      prisma.species.findUnique.mockResolvedValue({ id: 'cattle-id', code: 'BOS-TAU' });
      prisma.geoEntity.findUnique.mockResolvedValue({ id: 'ke-id' });
      prisma.denominator.findFirst.mockResolvedValue(null);
      prisma.denominator.create.mockResolvedValue({ id: 'denom-id' });

      const result = await service.importFaostat(csv, mockUser);

      expect(result.data.created).toBe(1);
      expect(prisma.denominator.create).toHaveBeenCalledOnce();
    });

    it('should skip unknown FAOSTAT item codes', async () => {
      const csv = 'Area Code,Area,Item Code,Item,Element,Year,Unit,Value\nKE,Kenya,9999,Unknown,Stocks,2024,Head,100';

      const result = await service.importFaostat(csv, mockUser);

      expect(result.data.skipped).toBe(1);
      expect(result.data.details[0].error).toContain('Unknown FAOSTAT item code');
    });

    it('should throw for missing FAOSTAT headers', async () => {
      const csv = 'wrong_header,data\nKE,100';

      await expect(service.importFaostat(csv, mockUser)).rejects.toThrow(BadRequestException);
    });

    it('should update existing denominator on re-import', async () => {
      const csv = 'Area Code,Area,Item Code,Item,Element,Year,Unit,Value\nKE,Kenya,866,Cattle,Stocks,2023,Head,20000000';
      prisma.species.findUnique.mockResolvedValue({ id: 'cattle-id', code: 'BOS-TAU' });
      prisma.geoEntity.findUnique.mockResolvedValue({ id: 'ke-id' });
      prisma.denominator.findFirst.mockResolvedValue({ id: 'existing-id', population: BigInt(19400000) });
      prisma.denominator.update.mockResolvedValue({ id: 'existing-id' });

      const result = await service.importFaostat(csv, mockUser);

      expect(result.data.updated).toBe(1);
      expect(prisma.denominator.update).toHaveBeenCalledOnce();
    });
  });

  describe('exportCsv', () => {
    it('should export geo entities as CSV', async () => {
      prisma.geoEntity.findMany.mockResolvedValue([
        { code: 'KE', name: 'Kenya', nameEn: 'Kenya', nameFr: 'Kenya', level: 'COUNTRY', countryCode: 'KE', centroidLat: -0.02, centroidLng: 37.91, version: 1 },
      ]);

      const csv = await service.exportCsv(ReferentialType.COUNTRIES);

      expect(csv).toContain('code,name,name_en');
      expect(csv).toContain('KE,Kenya,Kenya');
    });

    it('should export species as CSV', async () => {
      prisma.species.findMany.mockResolvedValue([
        { code: 'BOS-TAU', scientificName: 'Bos taurus', commonNameEn: 'Cattle', commonNameFr: 'Bovin', category: 'DOMESTIC', productionCategories: ['dairy', 'beef'], isWoahListed: true, version: 1 },
      ]);

      const csv = await service.exportCsv(ReferentialType.SPECIES);

      expect(csv).toContain('BOS-TAU');
      expect(csv).toContain('dairy;beef');
    });
  });
});

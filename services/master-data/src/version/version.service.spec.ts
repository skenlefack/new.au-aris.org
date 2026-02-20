import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VersionService } from './version.service';

describe('VersionService', () => {
  let service: VersionService;
  let prisma: Record<string, { count: ReturnType<typeof vi.fn>; findFirst: ReturnType<typeof vi.fn> }>;

  beforeEach(() => {
    const mockModel = () => ({
      count: vi.fn().mockResolvedValue(10),
      findFirst: vi.fn().mockResolvedValue({ updatedAt: new Date('2024-01-15') }),
    });

    prisma = {
      geoEntity: mockModel(),
      species: mockModel(),
      disease: mockModel(),
      unit: mockModel(),
      temporality: mockModel(),
      identifier: mockModel(),
      denominator: mockModel(),
    };

    service = new VersionService(prisma as any);
  });

  it('should return dictionary version with counts', async () => {
    const result = await service.getVersion();

    expect(result.data.service).toBe('master-data');
    expect(result.data.referentials.geoEntities.count).toBe(10);
    expect(result.data.referentials.species.count).toBe(10);
    expect(result.data.referentials.diseases.count).toBe(10);
    expect(result.data.referentials.units.count).toBe(10);
    expect(result.data.referentials.temporalities.count).toBe(10);
    expect(result.data.referentials.identifiers.count).toBe(10);
    expect(result.data.referentials.denominators.count).toBe(10);
  });

  it('should handle empty tables', async () => {
    for (const model of Object.values(prisma)) {
      model.count.mockResolvedValue(0);
      model.findFirst.mockResolvedValue(null);
    }

    const result = await service.getVersion();

    expect(result.data.referentials.geoEntities.count).toBe(0);
    expect(result.data.referentials.geoEntities.lastUpdated).toBeNull();
  });
});

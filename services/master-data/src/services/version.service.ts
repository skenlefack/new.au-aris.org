import type { PrismaClient } from '@prisma/client';
import type { ApiResponse } from '@aris/shared-types';

export interface DictionaryVersion {
  service: string;
  timestamp: string;
  referentials: {
    geoEntities: { count: number; lastUpdated: Date | null };
    species: { count: number; lastUpdated: Date | null };
    diseases: { count: number; lastUpdated: Date | null };
    units: { count: number; lastUpdated: Date | null };
    temporalities: { count: number; lastUpdated: Date | null };
    identifiers: { count: number; lastUpdated: Date | null };
    denominators: { count: number; lastUpdated: Date | null };
  };
}

export class VersionService {
  constructor(private readonly prisma: PrismaClient) {}

  async getVersion(): Promise<ApiResponse<DictionaryVersion>> {
    const [
      geoCount, geoLast,
      speciesCount, speciesLast,
      diseaseCount, diseaseLast,
      unitCount, unitLast,
      temporalityCount, temporalityLast,
      identifierCount, identifierLast,
      denominatorCount, denominatorLast,
    ] = await Promise.all([
      (this.prisma as any).geoEntity.count({ where: { isActive: true } }),
      (this.prisma as any).geoEntity.findFirst({ orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
      (this.prisma as any).species.count({ where: { isActive: true } }),
      (this.prisma as any).species.findFirst({ orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
      (this.prisma as any).disease.count({ where: { isActive: true } }),
      (this.prisma as any).disease.findFirst({ orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
      (this.prisma as any).unit.count({ where: { isActive: true } }),
      (this.prisma as any).unit.findFirst({ orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
      (this.prisma as any).temporality.count({ where: { isActive: true } }),
      (this.prisma as any).temporality.findFirst({ orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
      (this.prisma as any).identifier.count({ where: { isActive: true } }),
      (this.prisma as any).identifier.findFirst({ orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
      (this.prisma as any).denominator.count({ where: { isActive: true } }),
      (this.prisma as any).denominator.findFirst({ orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
    ]);

    return {
      data: {
        service: 'master-data',
        timestamp: new Date().toISOString(),
        referentials: {
          geoEntities: { count: geoCount, lastUpdated: geoLast?.updatedAt ?? null },
          species: { count: speciesCount, lastUpdated: speciesLast?.updatedAt ?? null },
          diseases: { count: diseaseCount, lastUpdated: diseaseLast?.updatedAt ?? null },
          units: { count: unitCount, lastUpdated: unitLast?.updatedAt ?? null },
          temporalities: { count: temporalityCount, lastUpdated: temporalityLast?.updatedAt ?? null },
          identifiers: { count: identifierCount, lastUpdated: identifierLast?.updatedAt ?? null },
          denominators: { count: denominatorCount, lastUpdated: denominatorLast?.updatedAt ?? null },
        },
      },
    };
  }
}

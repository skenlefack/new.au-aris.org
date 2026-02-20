import { Injectable } from '@nestjs/common';
import type { ApiResponse } from '@aris/shared-types';
import { PrismaService } from '../prisma.service';

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

@Injectable()
export class VersionService {
  constructor(private readonly prisma: PrismaService) {}

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
      this.prisma.geoEntity.count({ where: { isActive: true } }),
      this.prisma.geoEntity.findFirst({ orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
      this.prisma.species.count({ where: { isActive: true } }),
      this.prisma.species.findFirst({ orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
      this.prisma.disease.count({ where: { isActive: true } }),
      this.prisma.disease.findFirst({ orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
      this.prisma.unit.count({ where: { isActive: true } }),
      this.prisma.unit.findFirst({ orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
      this.prisma.temporality.count({ where: { isActive: true } }),
      this.prisma.temporality.findFirst({ orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
      this.prisma.identifier.count({ where: { isActive: true } }),
      this.prisma.identifier.findFirst({ orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
      this.prisma.denominator.count({ where: { isActive: true } }),
      this.prisma.denominator.findFirst({ orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
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

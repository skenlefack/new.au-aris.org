import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import {
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from '@aris/shared-types';
import type {
  PaginationQuery,
  PaginatedResponse,
  ApiResponse,
} from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateTemporalityDto } from './dto/create-temporality.dto';
import { UpdateTemporalityDto } from './dto/update-temporality.dto';
import type { TemporalityRecord } from './entities/temporality.entity';

@Injectable()
export class TemporalityService {
  private readonly logger = new Logger(TemporalityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateTemporalityDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<TemporalityRecord>> {
    const existing = await this.prisma.temporality.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException(`Temporality with code "${dto.code}" already exists`);
    }

    const entity = await this.prisma.temporality.create({
      data: {
        code: dto.code,
        nameEn: dto.nameEn,
        nameFr: dto.nameFr,
        calendarType: dto.calendarType,
        periodStart: new Date(dto.periodStart),
        periodEnd: new Date(dto.periodEnd),
        year: dto.year,
        weekNumber: dto.weekNumber ?? null,
        monthNumber: dto.monthNumber ?? null,
        quarterNumber: dto.quarterNumber ?? null,
        countryCode: dto.countryCode ?? null,
        isActive: dto.isActive ?? true,
      },
    });

    await this.audit.log({
      entityType: 'Temporality',
      entityId: entity.id,
      action: 'CREATE',
      user,
      newVersion: entity as unknown as object,
      dataClassification: 'PUBLIC',
    });

    this.logger.log(`Temporality created: ${entity.code} (${entity.id})`);
    return { data: entity as TemporalityRecord };
  }

  async findAll(
    query: PaginationQuery & { calendarType?: string; year?: number; countryCode?: string },
  ): Promise<PaginatedResponse<TemporalityRecord>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'asc' }
      : { periodStart: 'asc' as const };

    const where: Record<string, unknown> = { isActive: true };
    if (query.calendarType) where['calendarType'] = query.calendarType;
    if (query.year) where['year'] = query.year;
    if (query.countryCode) where['countryCode'] = query.countryCode;

    const [data, total] = await Promise.all([
      this.prisma.temporality.findMany({ where, skip, take: limit, orderBy }),
      this.prisma.temporality.count({ where }),
    ]);

    return {
      data: data as TemporalityRecord[],
      meta: { total, page, limit },
    };
  }

  async findOne(id: string): Promise<ApiResponse<TemporalityRecord>> {
    const entity = await this.prisma.temporality.findUnique({ where: { id } });
    if (!entity) {
      throw new NotFoundException(`Temporality ${id} not found`);
    }
    return { data: entity as TemporalityRecord };
  }

  async update(
    id: string,
    dto: UpdateTemporalityDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<TemporalityRecord>> {
    const existing = await this.prisma.temporality.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Temporality ${id} not found`);
    }

    const entity = await this.prisma.temporality.update({
      where: { id },
      data: {
        ...(dto.nameEn !== undefined && { nameEn: dto.nameEn }),
        ...(dto.nameFr !== undefined && { nameFr: dto.nameFr }),
        ...(dto.periodStart !== undefined && { periodStart: new Date(dto.periodStart) }),
        ...(dto.periodEnd !== undefined && { periodEnd: new Date(dto.periodEnd) }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        version: { increment: 1 },
      },
    });

    await this.audit.log({
      entityType: 'Temporality',
      entityId: entity.id,
      action: 'UPDATE',
      user,
      reason: dto.reason,
      previousVersion: existing as unknown as object,
      newVersion: entity as unknown as object,
      dataClassification: 'PUBLIC',
    });

    this.logger.log(`Temporality updated: ${entity.code} (${entity.id}) v${entity.version}`);
    return { data: entity as TemporalityRecord };
  }
}

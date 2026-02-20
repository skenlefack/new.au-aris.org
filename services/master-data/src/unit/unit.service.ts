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
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import type { UnitRecord } from './entities/unit.entity';

@Injectable()
export class UnitService {
  private readonly logger = new Logger(UnitService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateUnitDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<UnitRecord>> {
    const existing = await this.prisma.unit.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException(`Unit with code "${dto.code}" already exists`);
    }

    const entity = await this.prisma.unit.create({
      data: {
        code: dto.code,
        nameEn: dto.nameEn,
        nameFr: dto.nameFr,
        symbol: dto.symbol,
        category: dto.category,
        siConversion: dto.siConversion ?? null,
        isActive: dto.isActive ?? true,
      },
    });

    await this.audit.log({
      entityType: 'Unit',
      entityId: entity.id,
      action: 'CREATE',
      user,
      newVersion: entity as unknown as object,
      dataClassification: 'PUBLIC',
    });

    this.logger.log(`Unit created: ${entity.code} (${entity.id})`);
    return { data: entity as UnitRecord };
  }

  async findAll(
    query: PaginationQuery & { category?: string; search?: string },
  ): Promise<PaginatedResponse<UnitRecord>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'asc' }
      : { code: 'asc' as const };

    const where: Record<string, unknown> = { isActive: true };
    if (query.category) where['category'] = query.category;
    if (query.search) {
      where['OR'] = [
        { nameEn: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
        { symbol: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.unit.findMany({ where, skip, take: limit, orderBy }),
      this.prisma.unit.count({ where }),
    ]);

    return {
      data: data as UnitRecord[],
      meta: { total, page, limit },
    };
  }

  async findOne(id: string): Promise<ApiResponse<UnitRecord>> {
    const entity = await this.prisma.unit.findUnique({ where: { id } });
    if (!entity) {
      throw new NotFoundException(`Unit ${id} not found`);
    }
    return { data: entity as UnitRecord };
  }

  async update(
    id: string,
    dto: UpdateUnitDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<UnitRecord>> {
    const existing = await this.prisma.unit.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Unit ${id} not found`);
    }

    const entity = await this.prisma.unit.update({
      where: { id },
      data: {
        ...(dto.nameEn !== undefined && { nameEn: dto.nameEn }),
        ...(dto.nameFr !== undefined && { nameFr: dto.nameFr }),
        ...(dto.symbol !== undefined && { symbol: dto.symbol }),
        ...(dto.siConversion !== undefined && { siConversion: dto.siConversion }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        version: { increment: 1 },
      },
    });

    await this.audit.log({
      entityType: 'Unit',
      entityId: entity.id,
      action: 'UPDATE',
      user,
      reason: dto.reason,
      previousVersion: existing as unknown as object,
      newVersion: entity as unknown as object,
      dataClassification: 'PUBLIC',
    });

    this.logger.log(`Unit updated: ${entity.code} (${entity.id}) v${entity.version}`);
    return { data: entity as UnitRecord };
  }
}

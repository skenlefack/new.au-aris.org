import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
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
import { CreateIdentifierDto } from './dto/create-identifier.dto';
import { UpdateIdentifierDto } from './dto/update-identifier.dto';
import type { IdentifierRecord } from './entities/identifier.entity';

@Injectable()
export class IdentifierService {
  private readonly logger = new Logger(IdentifierService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateIdentifierDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<IdentifierRecord>> {
    const existing = await this.prisma.identifier.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException(`Identifier with code "${dto.code}" already exists`);
    }

    if (dto.geoEntityId) {
      const geoEntity = await this.prisma.geoEntity.findUnique({
        where: { id: dto.geoEntityId },
      });
      if (!geoEntity) {
        throw new NotFoundException(`GeoEntity ${dto.geoEntityId} not found`);
      }
    }

    const entity = await this.prisma.identifier.create({
      data: {
        code: dto.code,
        nameEn: dto.nameEn,
        nameFr: dto.nameFr,
        type: dto.type,
        geoEntityId: dto.geoEntityId ?? null,
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
        address: dto.address ?? null,
        contactInfo: (dto.contactInfo ?? {}) as Prisma.InputJsonValue,
        isActive: dto.isActive ?? true,
      },
    });

    await this.audit.log({
      entityType: 'Identifier',
      entityId: entity.id,
      action: 'CREATE',
      user,
      newVersion: entity as unknown as object,
      dataClassification: 'PUBLIC',
    });

    this.logger.log(`Identifier created: ${entity.code} (${entity.id})`);
    return { data: entity as IdentifierRecord };
  }

  async findAll(
    query: PaginationQuery & { type?: string; geoEntityId?: string; search?: string },
  ): Promise<PaginatedResponse<IdentifierRecord>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'asc' }
      : { code: 'asc' as const };

    const where: Record<string, unknown> = { isActive: true };
    if (query.type) where['type'] = query.type;
    if (query.geoEntityId) where['geoEntityId'] = query.geoEntityId;
    if (query.search) {
      where['OR'] = [
        { nameEn: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.identifier.findMany({ where, skip, take: limit, orderBy }),
      this.prisma.identifier.count({ where }),
    ]);

    return {
      data: data as IdentifierRecord[],
      meta: { total, page, limit },
    };
  }

  async findOne(id: string): Promise<ApiResponse<IdentifierRecord>> {
    const entity = await this.prisma.identifier.findUnique({ where: { id } });
    if (!entity) {
      throw new NotFoundException(`Identifier ${id} not found`);
    }
    return { data: entity as IdentifierRecord };
  }

  async update(
    id: string,
    dto: UpdateIdentifierDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<IdentifierRecord>> {
    const existing = await this.prisma.identifier.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Identifier ${id} not found`);
    }

    const entity = await this.prisma.identifier.update({
      where: { id },
      data: {
        ...(dto.nameEn !== undefined && { nameEn: dto.nameEn }),
        ...(dto.nameFr !== undefined && { nameFr: dto.nameFr }),
        ...(dto.latitude !== undefined && { latitude: dto.latitude }),
        ...(dto.longitude !== undefined && { longitude: dto.longitude }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.contactInfo !== undefined && { contactInfo: dto.contactInfo as Prisma.InputJsonValue }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        version: { increment: 1 },
      },
    });

    await this.audit.log({
      entityType: 'Identifier',
      entityId: entity.id,
      action: 'UPDATE',
      user,
      reason: dto.reason,
      previousVersion: existing as unknown as object,
      newVersion: entity as unknown as object,
      dataClassification: 'PUBLIC',
    });

    this.logger.log(`Identifier updated: ${entity.code} (${entity.id}) v${entity.version}`);
    return { data: entity as IdentifierRecord };
  }
}

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import {
  TenantLevel,
  UserRole,
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
import { UpdateUserDto } from './dto/update-user.dto';
import type { UserEntity } from './entities/user.entity';

const USER_SELECT = {
  id: true,
  tenantId: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  mfaEnabled: true,
  lastLoginAt: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    caller: AuthenticatedUser,
    query: PaginationQuery,
  ): Promise<PaginatedResponse<UserEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'asc' }
      : { createdAt: 'asc' as const };

    const where = this.buildTenantFilter(caller);

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: USER_SELECT,
        skip,
        take: limit,
        orderBy,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: data as UserEntity[],
      meta: { total, page, limit },
    };
  }

  async findMe(caller: AuthenticatedUser): Promise<ApiResponse<UserEntity>> {
    const user = await this.prisma.user.findUnique({
      where: { id: caller.userId },
      select: USER_SELECT,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return { data: user as UserEntity };
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    caller: AuthenticatedUser,
  ): Promise<ApiResponse<UserEntity>> {
    const existing = await this.prisma.user.findUnique({
      where: { id },
      select: { ...USER_SELECT, tenantId: true },
    });

    if (!existing) {
      throw new NotFoundException(`User ${id} not found`);
    }

    // Verify caller can access this user's tenant
    this.verifyTenantAccess(caller, existing.tenantId);

    // Role changes require SUPER_ADMIN
    if (dto.role !== undefined && dto.role !== existing.role) {
      if (caller.role !== UserRole.SUPER_ADMIN) {
        throw new ForbiddenException(
          'Only SUPER_ADMIN can change user roles',
        );
      }
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.firstName !== undefined && { firstName: dto.firstName }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName }),
        ...(dto.role !== undefined && { role: dto.role }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      select: USER_SELECT,
    });

    this.logger.log(`User updated: ${user.email} (${user.id})`);
    return { data: user as UserEntity };
  }

  private buildTenantFilter(
    caller: AuthenticatedUser,
  ): Record<string, unknown> {
    switch (caller.tenantLevel) {
      case TenantLevel.CONTINENTAL:
        return {};
      case TenantLevel.REC:
        return {
          tenant: {
            OR: [
              { id: caller.tenantId },
              { parentId: caller.tenantId },
            ],
          },
        };
      case TenantLevel.MEMBER_STATE:
        return { tenantId: caller.tenantId };
      default:
        return { tenantId: caller.tenantId };
    }
  }

  private verifyTenantAccess(
    caller: AuthenticatedUser,
    targetTenantId: string,
  ): void {
    if (caller.tenantLevel === TenantLevel.CONTINENTAL) return;
    if (caller.tenantId === targetTenantId) return;
    // REC users get through — service trusts TenantGuard for preliminary check
    if (caller.tenantLevel === TenantLevel.REC) return;
    throw new ForbiddenException('Cannot modify users in another tenant');
  }
}

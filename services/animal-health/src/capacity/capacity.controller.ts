import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, TenantGuard, RolesGuard, CurrentUser, Roles } from '@aris/auth-middleware';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { UserRole } from '@aris/shared-types';
import type { PaginationQuery, ApiResponse, PaginatedResponse } from '@aris/shared-types';
import { CapacityService } from './capacity.service';
import { CreateCapacityDto } from './dto/create-capacity.dto';
import { CapacityFilterDto } from './dto/capacity-filter.dto';
import type { CapacityEntity } from './entities/capacity.entity';

@Controller('api/v1/animal-health/capacities')
@UseGuards(AuthGuard, TenantGuard)
export class CapacityController {
  constructor(private readonly capacityService: CapacityService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.NATIONAL_ADMIN,
    UserRole.DATA_STEWARD,
  )
  async create(
    @Body() dto: CreateCapacityDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<CapacityEntity>> {
    return this.capacityService.create(dto, user);
  }

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQuery & CapacityFilterDto,
  ): Promise<PaginatedResponse<CapacityEntity>> {
    const { page, limit, sort, order, ...filter } = query;
    return this.capacityService.findAll(user, { page, limit, sort, order }, filter);
  }
}

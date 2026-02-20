import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AuthGuard, TenantGuard, RolesGuard, CurrentUser, Roles } from '@aris/auth-middleware';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { UserRole } from '@aris/shared-types';
import type { PaginationQuery, ApiResponse, PaginatedResponse } from '@aris/shared-types';
import { CapacityService } from './capacity.service';
import { CreateCapacityDto } from './dto/create-capacity.dto';
import { UpdateCapacityDto } from './dto/update-capacity.dto';
import { CapacityFilterDto } from './dto/capacity-filter.dto';
import type { InstitutionalCapacityEntity } from './entities/capacity.entity';

@Controller('api/v1/governance/capacities')
@UseGuards(AuthGuard, TenantGuard)
export class CapacityController {
  constructor(private readonly capacityService: CapacityService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.CONTINENTAL_ADMIN,
    UserRole.NATIONAL_ADMIN,
    UserRole.DATA_STEWARD,
    UserRole.FIELD_AGENT,
  )
  async create(
    @Body() dto: CreateCapacityDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<InstitutionalCapacityEntity>> {
    return this.capacityService.create(dto, user);
  }

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQuery & CapacityFilterDto,
  ): Promise<PaginatedResponse<InstitutionalCapacityEntity>> {
    const { page, limit, sort, order, ...filter } = query;
    return this.capacityService.findAll(user, { page, limit, sort, order }, filter);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<InstitutionalCapacityEntity>> {
    return this.capacityService.findOne(id, user);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.CONTINENTAL_ADMIN,
    UserRole.NATIONAL_ADMIN,
    UserRole.DATA_STEWARD,
  )
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCapacityDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<InstitutionalCapacityEntity>> {
    return this.capacityService.update(id, dto, user);
  }
}

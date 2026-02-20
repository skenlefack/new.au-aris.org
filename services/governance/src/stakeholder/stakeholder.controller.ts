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
import { StakeholderService } from './stakeholder.service';
import { CreateStakeholderDto } from './dto/create-stakeholder.dto';
import { UpdateStakeholderDto } from './dto/update-stakeholder.dto';
import { StakeholderFilterDto } from './dto/stakeholder-filter.dto';
import type { StakeholderRegistryEntity } from './entities/stakeholder.entity';

@Controller('api/v1/governance/stakeholders')
@UseGuards(AuthGuard, TenantGuard)
export class StakeholderController {
  constructor(private readonly stakeholderService: StakeholderService) {}

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
    @Body() dto: CreateStakeholderDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<StakeholderRegistryEntity>> {
    return this.stakeholderService.create(dto, user);
  }

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQuery & StakeholderFilterDto,
  ): Promise<PaginatedResponse<StakeholderRegistryEntity>> {
    const { page, limit, sort, order, ...filter } = query;
    return this.stakeholderService.findAll(user, { page, limit, sort, order }, filter);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<StakeholderRegistryEntity>> {
    return this.stakeholderService.findOne(id, user);
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
    @Body() dto: UpdateStakeholderDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<StakeholderRegistryEntity>> {
    return this.stakeholderService.update(id, dto, user);
  }
}

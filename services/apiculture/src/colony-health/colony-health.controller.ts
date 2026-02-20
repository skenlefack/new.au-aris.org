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
import { ColonyHealthService } from './colony-health.service';
import { CreateColonyHealthDto } from './dto/create-colony-health.dto';
import { UpdateColonyHealthDto } from './dto/update-colony-health.dto';
import { ColonyHealthFilterDto } from './dto/colony-health-filter.dto';
import type { ColonyHealthEntity } from './entities/colony-health.entity';

@Controller('api/v1/apiculture/health')
@UseGuards(AuthGuard, TenantGuard)
export class ColonyHealthController {
  constructor(private readonly colonyHealthService: ColonyHealthService) {}

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
    @Body() dto: CreateColonyHealthDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<ColonyHealthEntity>> {
    return this.colonyHealthService.create(dto, user);
  }

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQuery & ColonyHealthFilterDto,
  ): Promise<PaginatedResponse<ColonyHealthEntity>> {
    const { page, limit, sort, order, ...filter } = query;
    return this.colonyHealthService.findAll(user, { page, limit, sort, order }, filter);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<ColonyHealthEntity>> {
    return this.colonyHealthService.findOne(id, user);
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
    @Body() dto: UpdateColonyHealthDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<ColonyHealthEntity>> {
    return this.colonyHealthService.update(id, dto, user);
  }
}

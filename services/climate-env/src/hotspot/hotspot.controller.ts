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
import { HotspotService } from './hotspot.service';
import { CreateHotspotDto } from './dto/create-hotspot.dto';
import { UpdateHotspotDto } from './dto/update-hotspot.dto';
import { HotspotFilterDto } from './dto/hotspot-filter.dto';
import type { EnvironmentalHotspotEntity } from './entities/hotspot.entity';

@Controller('api/v1/climate/hotspots')
@UseGuards(AuthGuard, TenantGuard)
export class HotspotController {
  constructor(private readonly hotspotService: HotspotService) {}

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
    @Body() dto: CreateHotspotDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<EnvironmentalHotspotEntity>> {
    return this.hotspotService.create(dto, user);
  }

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQuery & HotspotFilterDto,
  ): Promise<PaginatedResponse<EnvironmentalHotspotEntity>> {
    const { page, limit, sort, order, ...filter } = query;
    return this.hotspotService.findAll(user, { page, limit, sort, order }, filter);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<EnvironmentalHotspotEntity>> {
    return this.hotspotService.findOne(id, user);
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
    @Body() dto: UpdateHotspotDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<EnvironmentalHotspotEntity>> {
    return this.hotspotService.update(id, dto, user);
  }
}

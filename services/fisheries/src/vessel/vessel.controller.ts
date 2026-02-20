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
import { VesselService } from './vessel.service';
import { CreateVesselDto } from './dto/create-vessel.dto';
import { UpdateVesselDto } from './dto/update-vessel.dto';
import { VesselFilterDto } from './dto/vessel-filter.dto';
import type { FishingVesselEntity } from './entities/vessel.entity';

@Controller('api/v1/fisheries/vessels')
@UseGuards(AuthGuard, TenantGuard)
export class VesselController {
  constructor(private readonly vesselService: VesselService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.CONTINENTAL_ADMIN,
    UserRole.NATIONAL_ADMIN,
    UserRole.DATA_STEWARD,
  )
  async create(
    @Body() dto: CreateVesselDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<FishingVesselEntity>> {
    return this.vesselService.create(dto, user);
  }

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQuery & VesselFilterDto,
  ): Promise<PaginatedResponse<FishingVesselEntity>> {
    const { page, limit, sort, order, ...filter } = query;
    return this.vesselService.findAll(user, { page, limit, sort, order }, filter);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<FishingVesselEntity>> {
    return this.vesselService.findOne(id, user);
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
    @Body() dto: UpdateVesselDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<FishingVesselEntity>> {
    return this.vesselService.update(id, dto, user);
  }
}

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
import { WaterStressService } from './water-stress.service';
import { CreateWaterStressDto } from './dto/create-water-stress.dto';
import { UpdateWaterStressDto } from './dto/update-water-stress.dto';
import { WaterStressFilterDto } from './dto/water-stress-filter.dto';
import type { WaterStressIndexEntity } from './entities/water-stress.entity';

@Controller('api/v1/climate/water-stress')
@UseGuards(AuthGuard, TenantGuard)
export class WaterStressController {
  constructor(private readonly waterStressService: WaterStressService) {}

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
    @Body() dto: CreateWaterStressDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<WaterStressIndexEntity>> {
    return this.waterStressService.create(dto, user);
  }

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQuery & WaterStressFilterDto,
  ): Promise<PaginatedResponse<WaterStressIndexEntity>> {
    const { page, limit, sort, order, ...filter } = query;
    return this.waterStressService.findAll(user, { page, limit, sort, order }, filter);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<WaterStressIndexEntity>> {
    return this.waterStressService.findOne(id, user);
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
    @Body() dto: UpdateWaterStressDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<WaterStressIndexEntity>> {
    return this.waterStressService.update(id, dto, user);
  }
}

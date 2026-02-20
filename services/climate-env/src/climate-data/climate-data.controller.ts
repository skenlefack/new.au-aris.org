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
import { ClimateDataService } from './climate-data.service';
import { CreateClimateDataDto } from './dto/create-climate-data.dto';
import { UpdateClimateDataDto } from './dto/update-climate-data.dto';
import { ClimateDataFilterDto } from './dto/climate-data-filter.dto';
import type { ClimateDataPointEntity } from './entities/climate-data.entity';

@Controller('api/v1/climate/climate-data')
@UseGuards(AuthGuard, TenantGuard)
export class ClimateDataController {
  constructor(private readonly climateDataService: ClimateDataService) {}

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
    @Body() dto: CreateClimateDataDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<ClimateDataPointEntity>> {
    return this.climateDataService.create(dto, user);
  }

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQuery & ClimateDataFilterDto,
  ): Promise<PaginatedResponse<ClimateDataPointEntity>> {
    const { page, limit, sort, order, ...filter } = query;
    return this.climateDataService.findAll(user, { page, limit, sort, order }, filter);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<ClimateDataPointEntity>> {
    return this.climateDataService.findOne(id, user);
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
    @Body() dto: UpdateClimateDataDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<ClimateDataPointEntity>> {
    return this.climateDataService.update(id, dto, user);
  }
}

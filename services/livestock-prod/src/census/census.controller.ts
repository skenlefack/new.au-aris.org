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
import { CensusService } from './census.service';
import { CreateCensusDto } from './dto/create-census.dto';
import { UpdateCensusDto } from './dto/update-census.dto';
import { CensusFilterDto } from './dto/census-filter.dto';
import type { LivestockCensusEntity } from './entities/census.entity';

@Controller('api/v1/livestock/census')
@UseGuards(AuthGuard, TenantGuard)
export class CensusController {
  constructor(private readonly censusService: CensusService) {}

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
    @Body() dto: CreateCensusDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<LivestockCensusEntity>> {
    return this.censusService.create(dto, user);
  }

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQuery & CensusFilterDto,
  ): Promise<PaginatedResponse<LivestockCensusEntity>> {
    const { page, limit, sort, order, ...filter } = query;
    return this.censusService.findAll(user, { page, limit, sort, order }, filter);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<LivestockCensusEntity>> {
    return this.censusService.findOne(id, user);
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
    @Body() dto: UpdateCensusDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<LivestockCensusEntity>> {
    return this.censusService.update(id, dto, user);
  }
}

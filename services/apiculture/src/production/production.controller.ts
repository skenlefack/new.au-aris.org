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
import { ProductionService } from './production.service';
import { CreateHoneyProductionDto } from './dto/create-production.dto';
import { UpdateHoneyProductionDto } from './dto/update-production.dto';
import { ProductionFilterDto } from './dto/production-filter.dto';
import type { HoneyProductionEntity } from './entities/production.entity';

@Controller('api/v1/apiculture/production')
@UseGuards(AuthGuard, TenantGuard)
export class ProductionController {
  constructor(private readonly productionService: ProductionService) {}

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
    @Body() dto: CreateHoneyProductionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<HoneyProductionEntity>> {
    return this.productionService.create(dto, user);
  }

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQuery & ProductionFilterDto,
  ): Promise<PaginatedResponse<HoneyProductionEntity>> {
    const { page, limit, sort, order, ...filter } = query;
    return this.productionService.findAll(user, { page, limit, sort, order }, filter);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<HoneyProductionEntity>> {
    return this.productionService.findOne(id, user);
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
    @Body() dto: UpdateHoneyProductionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<HoneyProductionEntity>> {
    return this.productionService.update(id, dto, user);
  }
}

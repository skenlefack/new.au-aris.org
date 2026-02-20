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
import { AquacultureProductionService } from './aquaculture-production.service';
import { CreateAquacultureProductionDto } from './dto/create-aquaculture-production.dto';
import { UpdateAquacultureProductionDto } from './dto/update-aquaculture-production.dto';
import { AquacultureProductionFilterDto } from './dto/aquaculture-production-filter.dto';
import type { AquacultureProductionEntity } from './entities/aquaculture-production.entity';

@Controller('api/v1/fisheries/aquaculture/production')
@UseGuards(AuthGuard, TenantGuard)
export class AquacultureProductionController {
  constructor(private readonly productionService: AquacultureProductionService) {}

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
    @Body() dto: CreateAquacultureProductionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<AquacultureProductionEntity>> {
    return this.productionService.create(dto, user);
  }

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQuery & AquacultureProductionFilterDto,
  ): Promise<PaginatedResponse<AquacultureProductionEntity>> {
    const { page, limit, sort, order, ...filter } = query;
    return this.productionService.findAll(user, { page, limit, sort, order }, filter);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<AquacultureProductionEntity>> {
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
    @Body() dto: UpdateAquacultureProductionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<AquacultureProductionEntity>> {
    return this.productionService.update(id, dto, user);
  }
}

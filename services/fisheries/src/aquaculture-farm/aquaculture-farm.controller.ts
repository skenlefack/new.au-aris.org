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
import { AquacultureFarmService } from './aquaculture-farm.service';
import { CreateAquacultureFarmDto } from './dto/create-aquaculture-farm.dto';
import { UpdateAquacultureFarmDto } from './dto/update-aquaculture-farm.dto';
import { AquacultureFarmFilterDto } from './dto/aquaculture-farm-filter.dto';
import type { AquacultureFarmEntity } from './entities/aquaculture-farm.entity';

@Controller('api/v1/fisheries/aquaculture/farms')
@UseGuards(AuthGuard, TenantGuard)
export class AquacultureFarmController {
  constructor(private readonly farmService: AquacultureFarmService) {}

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
    @Body() dto: CreateAquacultureFarmDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<AquacultureFarmEntity>> {
    return this.farmService.create(dto, user);
  }

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQuery & AquacultureFarmFilterDto,
  ): Promise<PaginatedResponse<AquacultureFarmEntity>> {
    const { page, limit, sort, order, ...filter } = query;
    return this.farmService.findAll(user, { page, limit, sort, order }, filter);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<AquacultureFarmEntity>> {
    return this.farmService.findOne(id, user);
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
    @Body() dto: UpdateAquacultureFarmDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<AquacultureFarmEntity>> {
    return this.farmService.update(id, dto, user);
  }
}

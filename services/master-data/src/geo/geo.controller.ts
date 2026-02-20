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
import {
  AuthGuard,
  RolesGuard,
  TenantGuard,
  Roles,
  CurrentUser,
} from '@aris/auth-middleware';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { UserRole } from '@aris/shared-types';
import type {
  ApiResponse,
  PaginatedResponse,
  PaginationQuery,
} from '@aris/shared-types';
import { GeoService } from './geo.service';
import { CreateGeoEntityDto } from './dto/create-geo-entity.dto';
import { UpdateGeoEntityDto } from './dto/update-geo-entity.dto';
import type { GeoEntityRecord } from './entities/geo-entity.entity';

@Controller('api/v1/master-data/geo')
@UseGuards(AuthGuard, TenantGuard)
export class GeoController {
  constructor(private readonly geoService: GeoService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN)
  async create(
    @Body() dto: CreateGeoEntityDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<GeoEntityRecord>> {
    return this.geoService.create(dto, user);
  }

  @Get()
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('sort') sort?: string,
    @Query('order') order?: 'asc' | 'desc',
    @Query('level') level?: string,
    @Query('countryCode') countryCode?: string,
    @Query('parentId') parentId?: string,
    @Query('search') search?: string,
  ): Promise<PaginatedResponse<GeoEntityRecord>> {
    return this.geoService.findAll({
      page, limit, sort, order,
      level, countryCode, parentId, search,
    });
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<GeoEntityRecord>> {
    return this.geoService.findOne(id);
  }

  @Get('code/:code')
  async findByCode(
    @Param('code') code: string,
  ): Promise<ApiResponse<GeoEntityRecord>> {
    return this.geoService.findByCode(code);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGeoEntityDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<GeoEntityRecord>> {
    return this.geoService.update(id, dto, user);
  }

  @Get(':id/children')
  async findChildren(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<PaginatedResponse<GeoEntityRecord>> {
    const query: PaginationQuery = { page, limit };
    return this.geoService.findChildren(id, query);
  }
}

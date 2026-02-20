import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, TenantGuard } from '@aris/auth-middleware';
import type { ApiResponse } from '@aris/shared-types';
import { GeoService } from './geo.service';
import { WithinQueryDto } from './dto/within-query.dto';
import { NearestQueryDto } from './dto/nearest-query.dto';
import { ContainsQueryDto } from './dto/contains-query.dto';
import { RiskMapQueryDto } from './dto/risk-map-query.dto';
import type {
  MapLayerEntity,
  ContainsResult,
  RiskZoneProperties,
  GeoJsonFeatureCollection,
  GeoJsonFeature,
} from './entities/geo.entity';

@Controller('api/v1/geo')
@UseGuards(AuthGuard, TenantGuard)
export class GeoController {
  constructor(private readonly geoService: GeoService) {}

  @Get('layers')
  async listLayers(): Promise<ApiResponse<MapLayerEntity[]>> {
    return this.geoService.listLayers();
  }

  @Get('query/within')
  async queryWithin(
    @Query() dto: WithinQueryDto,
  ): Promise<ApiResponse<GeoJsonFeatureCollection>> {
    return this.geoService.queryWithin(dto);
  }

  @Get('query/nearest')
  async queryNearest(
    @Query() dto: NearestQueryDto,
  ): Promise<ApiResponse<GeoJsonFeatureCollection>> {
    return this.geoService.queryNearest(dto);
  }

  @Get('query/contains')
  async queryContains(
    @Query() dto: ContainsQueryDto,
  ): Promise<ApiResponse<ContainsResult[]>> {
    return this.geoService.queryContains(dto);
  }

  @Get('risk-map')
  async getRiskMap(
    @Query() dto: RiskMapQueryDto,
  ): Promise<ApiResponse<GeoJsonFeatureCollection<RiskZoneProperties>>> {
    return this.geoService.getRiskMap(dto);
  }

  @Get('admin-boundaries/:code')
  async getAdminBoundary(
    @Param('code') code: string,
  ): Promise<ApiResponse<GeoJsonFeature>> {
    return this.geoService.getAdminBoundary(code);
  }
}

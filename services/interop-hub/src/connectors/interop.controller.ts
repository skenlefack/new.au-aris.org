import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  AuthGuard,
  TenantGuard,
  CurrentUser,
} from '@aris/auth-middleware';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import type {
  ApiResponse,
  PaginatedResponse,
  PaginationQuery,
} from '@aris/shared-types';
import { WahisService } from './wahis.service';
import { EmpresService } from './empres.service';
import { FaostatService } from './faostat.service';
import { FishstatjService } from './fishstatj.service';
import { CitesService } from './cites.service';
import { ConnectorService } from './connector.service';
import { CreateWahisExportDto } from '../dto/wahis-export.dto';
import { CreateEmpresFeedDto } from '../dto/empres-feed.dto';
import { CreateFaostatSyncDto } from '../dto/faostat-sync.dto';
import { CreateFishstatjExportDto } from '../dto/fishstatj-export.dto';
import { CreateCitesExportDto } from '../dto/cites-export.dto';
import type {
  ExportRecordEntity,
  FeedRecordEntity,
  SyncRecordEntity,
  ConnectorConfigEntity,
  ConnectorHealth,
} from '../entities/interop.entity';

@Controller('api/v1/interop')
@UseGuards(AuthGuard, TenantGuard)
export class InteropController {
  constructor(
    private readonly wahisService: WahisService,
    private readonly empresService: EmpresService,
    private readonly faostatService: FaostatService,
    private readonly fishstatjService: FishstatjService,
    private readonly citesService: CitesService,
    private readonly connectorService: ConnectorService,
  ) {}

  // ── WAHIS ──

  @Post('wahis/export')
  async createWahisExport(
    @Body() dto: CreateWahisExportDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<ExportRecordEntity>> {
    return this.wahisService.createExport(dto, user);
  }

  @Get('wahis/exports')
  async listWahisExports(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('sort') sort?: string,
    @Query('order') order?: 'asc' | 'desc',
  ): Promise<PaginatedResponse<ExportRecordEntity>> {
    const query: PaginationQuery = { page, limit, sort, order };
    return this.wahisService.findAll(user, query);
  }

  @Get('wahis/exports/:id')
  async getWahisExport(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<ExportRecordEntity>> {
    return this.wahisService.findOne(id, user);
  }

  // ── EMPRES ──

  @Post('empres/feed')
  async createEmpresFeed(
    @Body() dto: CreateEmpresFeedDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<FeedRecordEntity>> {
    return this.empresService.createFeed(dto, user);
  }

  @Get('empres/feeds')
  async listEmpresFeeds(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('sort') sort?: string,
    @Query('order') order?: 'asc' | 'desc',
  ): Promise<PaginatedResponse<FeedRecordEntity>> {
    const query: PaginationQuery = { page, limit, sort, order };
    return this.empresService.findAll(user, query);
  }

  // ── FAOSTAT ──

  @Post('faostat/sync')
  async createFaostatSync(
    @Body() dto: CreateFaostatSyncDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<SyncRecordEntity>> {
    return this.faostatService.createSync(dto, user);
  }

  @Get('faostat/syncs')
  async listFaostatSyncs(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('sort') sort?: string,
    @Query('order') order?: 'asc' | 'desc',
  ): Promise<PaginatedResponse<SyncRecordEntity>> {
    const query: PaginationQuery = { page, limit, sort, order };
    return this.faostatService.findAll(user, query);
  }

  // ── FishStatJ ──

  @Post('fishstatj/export')
  async createFishstatjExport(
    @Body() dto: CreateFishstatjExportDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<ExportRecordEntity>> {
    return this.fishstatjService.createExport(dto, user);
  }

  @Get('fishstatj/exports')
  async listFishstatjExports(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('sort') sort?: string,
    @Query('order') order?: 'asc' | 'desc',
  ): Promise<PaginatedResponse<ExportRecordEntity>> {
    const query: PaginationQuery = { page, limit, sort, order };
    return this.fishstatjService.findAll(user, query);
  }

  @Get('fishstatj/exports/:id')
  async getFishstatjExport(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<ExportRecordEntity>> {
    return this.fishstatjService.findOne(id, user);
  }

  // ── CITES ──

  @Post('cites/export')
  async createCitesExport(
    @Body() dto: CreateCitesExportDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<ExportRecordEntity>> {
    return this.citesService.createExport(dto, user);
  }

  @Get('cites/exports')
  async listCitesExports(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('sort') sort?: string,
    @Query('order') order?: 'asc' | 'desc',
  ): Promise<PaginatedResponse<ExportRecordEntity>> {
    const query: PaginationQuery = { page, limit, sort, order };
    return this.citesService.findAll(user, query);
  }

  @Get('cites/exports/:id')
  async getCitesExport(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<ExportRecordEntity>> {
    return this.citesService.findOne(id, user);
  }

  // ── Connector management ──

  @Get('connectors')
  async listConnectors(): Promise<ApiResponse<ConnectorConfigEntity[]>> {
    return this.connectorService.listConnectors();
  }

  @Get('health')
  async healthCheck(): Promise<ApiResponse<ConnectorHealth[]>> {
    return this.connectorService.healthCheck();
  }
}

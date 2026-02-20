import {
  Controller,
  Get,
  Param,
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
import { ReportService } from './report.service';
import type { QualityReportEntity } from '../validate/entities/quality-report.entity';

@Controller('api/v1/data-quality/reports')
@UseGuards(AuthGuard, TenantGuard)
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('sort') sort?: string,
    @Query('order') order?: 'asc' | 'desc',
    @Query('domain') domain?: string,
    @Query('status') status?: string,
    @Query('recordId') recordId?: string,
  ): Promise<PaginatedResponse<QualityReportEntity>> {
    return this.reportService.findAll(user, {
      page, limit, sort, order,
      domain, status, recordId,
    });
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<QualityReportEntity>> {
    return this.reportService.findOne(id, user);
  }
}

import {
  Controller,
  Get,
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
} from '@aris/shared-types';
import { CorrectionService, type CorrectionEntity } from './correction.service';

@Controller('api/v1/data-quality/corrections')
@UseGuards(AuthGuard, TenantGuard)
export class CorrectionController {
  constructor(private readonly correctionService: CorrectionService) {}

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ): Promise<PaginatedResponse<CorrectionEntity>> {
    return this.correctionService.findAll(user, { page, limit, status });
  }

  @Get(':reportId')
  async findByReportId(
    @Param('reportId', ParseUUIDPipe) reportId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<CorrectionEntity>> {
    return this.correctionService.findByReportId(reportId, user);
  }

  @Patch(':reportId/corrected')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.CONTINENTAL_ADMIN,
    UserRole.DATA_STEWARD,
  )
  async markCorrected(
    @Param('reportId', ParseUUIDPipe) reportId: string,
  ): Promise<ApiResponse<CorrectionEntity>> {
    return this.correctionService.markCorrected(reportId);
  }

  @Patch(':reportId/assign')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.CONTINENTAL_ADMIN,
    UserRole.DATA_STEWARD,
    UserRole.NATIONAL_ADMIN,
  )
  async assign(
    @Param('reportId', ParseUUIDPipe) reportId: string,
    @Body('assignedTo', ParseUUIDPipe) assignedTo: string,
  ): Promise<ApiResponse<CorrectionEntity>> {
    return this.correctionService.assign(reportId, assignedTo);
  }
}

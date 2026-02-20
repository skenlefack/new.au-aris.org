import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  AuthGuard,
  TenantGuard,
  CurrentUser,
} from '@aris/auth-middleware';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import type { ApiResponse } from '@aris/shared-types';
import { DashboardService } from './dashboard.service';
import type { DashboardKpis } from './dashboard.service';

@Controller('api/v1/data-quality/dashboard')
@UseGuards(AuthGuard, TenantGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  async getKpis(
    @CurrentUser() user: AuthenticatedUser,
    @Query('domain') domain?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<ApiResponse<DashboardKpis>> {
    return this.dashboardService.getKpis(user, { domain, from, to });
  }
}

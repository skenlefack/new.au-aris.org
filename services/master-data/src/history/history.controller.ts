import {
  Controller,
  Get,
  Delete,
  Param,
  Query,
  Body,
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
import type { ApiResponse, PaginatedResponse } from '@aris/shared-types';
import { HistoryService } from './history.service';

@Controller('api/v1/master-data')
@UseGuards(AuthGuard, TenantGuard)
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Get(':type/:id/history')
  async getHistory(
    @Param('type') type: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<PaginatedResponse<unknown>> {
    return this.historyService.getHistory(type, id, { page, limit });
  }

  @Delete(':type/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN)
  async softDelete(
    @Param('type') type: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body('reason') reason?: string,
  ): Promise<ApiResponse<{ deleted: boolean }>> {
    return this.historyService.softDelete(type, id, user, reason);
  }
}

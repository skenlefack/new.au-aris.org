import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Header,
  UseGuards,
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
import type { ApiResponse } from '@aris/shared-types';
import { ImportExportService } from './import-export.service';
import { ReferentialType } from './dto/import-export.dto';
import type { CsvImportDto, FaostatImportDto, ImportReport } from './dto/import-export.dto';

@Controller('api/v1/master-data')
@UseGuards(AuthGuard, TenantGuard)
export class ImportExportController {
  constructor(private readonly importExportService: ImportExportService) {}

  @Post('import/csv')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN, UserRole.DATA_STEWARD)
  async importCsv(
    @Body() dto: CsvImportDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<ImportReport>> {
    return this.importExportService.importCsv(dto.type, dto.csvContent, user, dto.reason);
  }

  @Get('export/csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportCsv(
    @Query('type') type: ReferentialType,
  ): Promise<string> {
    return this.importExportService.exportCsv(type);
  }

  @Post('import/faostat')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN, UserRole.DATA_STEWARD)
  async importFaostat(
    @Body() dto: FaostatImportDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<ImportReport>> {
    return this.importExportService.importFaostat(dto.csvContent, user, dto.reason);
  }
}

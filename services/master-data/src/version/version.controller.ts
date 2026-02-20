import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard, TenantGuard } from '@aris/auth-middleware';
import type { ApiResponse } from '@aris/shared-types';
import { VersionService } from './version.service';
import type { DictionaryVersion } from './version.service';

@Controller('api/v1/master-data/version')
@UseGuards(AuthGuard, TenantGuard)
export class VersionController {
  constructor(private readonly versionService: VersionService) {}

  @Get()
  async getVersion(): Promise<ApiResponse<DictionaryVersion>> {
    return this.versionService.getVersion();
  }
}

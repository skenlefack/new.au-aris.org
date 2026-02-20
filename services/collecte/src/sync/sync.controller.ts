import {
  Controller,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  AuthGuard,
  TenantGuard,
  CurrentUser,
} from '@aris/auth-middleware';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { SyncService } from './sync.service';
import { SyncRequestDto } from './dto/sync-request.dto';
import type { SyncResponse } from './dto/sync-response.dto';

@Controller('api/v1/collecte/sync')
@UseGuards(AuthGuard, TenantGuard)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post()
  async deltaSync(
    @Body() dto: SyncRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SyncResponse> {
    return this.syncService.deltaSync(dto, user);
  }
}

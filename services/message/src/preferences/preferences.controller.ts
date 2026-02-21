import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, CurrentUser } from '@aris/auth-middleware';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import type { ApiResponse } from '@aris/shared-types';
import { PreferencesService } from './preferences.service';
import { UpsertPreferenceDto } from './dto/upsert-preference.dto';
import type { NotificationPreferenceEntity } from './entities/preference.entity';

@Controller('api/v1/messages/preferences')
@UseGuards(AuthGuard)
export class PreferencesController {
  constructor(private readonly preferencesService: PreferencesService) {}

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<NotificationPreferenceEntity[]>> {
    return this.preferencesService.findAll(user.userId, user.tenantId);
  }

  @Post()
  async upsert(
    @Body() dto: UpsertPreferenceDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<NotificationPreferenceEntity>> {
    return this.preferencesService.upsert(dto, user);
  }
}

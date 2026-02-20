import {
  Controller,
  Get,
  Post,
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
  Roles,
  CurrentUser,
} from '@aris/auth-middleware';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { UserRole } from '@aris/shared-types';
import type { PaginatedResponse, ApiResponse } from '@aris/shared-types';
import { NotificationService } from './notification.service';
import { SendNotificationDto } from './dto/send-notification.dto';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import type { NotificationEntity } from './entities/notification.entity';

@Controller('api/v1/messages')
@UseGuards(AuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListNotificationsDto,
  ): Promise<PaginatedResponse<NotificationEntity>> {
    return this.notificationService.findAll(
      user.userId,
      user.tenantId,
      query,
    );
  }

  @Get('unread-count')
  async getUnreadCount(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<{ count: number }>> {
    return this.notificationService.getUnreadCount(
      user.userId,
      user.tenantId,
    );
  }

  @Patch(':id/read')
  async markAsRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<NotificationEntity>> {
    return this.notificationService.markAsRead(
      id,
      user.userId,
      user.tenantId,
    );
  }

  @Post('send')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.CONTINENTAL_ADMIN,
    UserRole.REC_ADMIN,
    UserRole.NATIONAL_ADMIN,
  )
  async sendManual(
    @Body() dto: SendNotificationDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<NotificationEntity>> {
    return this.notificationService.sendManual(dto, user);
  }
}

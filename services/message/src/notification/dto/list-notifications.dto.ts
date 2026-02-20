import { IsOptional, IsEnum, IsIn } from 'class-validator';
import { NotificationChannel, NotificationStatus } from '@aris/shared-types';
import type { PaginationQuery } from '@aris/shared-types';

export class ListNotificationsDto implements PaginationQuery {
  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;

  @IsOptional()
  @IsIn(['createdAt', 'readAt'])
  sort?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';

  @IsOptional()
  @IsEnum(NotificationChannel)
  channel?: NotificationChannel;

  @IsOptional()
  @IsEnum(NotificationStatus)
  status?: NotificationStatus;
}

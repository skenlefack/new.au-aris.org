import {
  IsString,
  IsUUID,
  IsEnum,
  IsOptional,
  MaxLength,
  IsObject,
} from 'class-validator';
import { NotificationChannel } from '@aris/shared-types';

export class SendNotificationDto {
  @IsUUID()
  userId!: string;

  @IsEnum(NotificationChannel)
  channel!: NotificationChannel;

  @IsString()
  @MaxLength(500)
  subject!: string;

  @IsString()
  body!: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

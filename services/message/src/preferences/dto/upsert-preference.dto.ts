import { IsString, IsBoolean, IsOptional, IsIn } from 'class-validator';
import { NOTIFICATION_EVENT_TYPES } from '../entities/preference.entity';

export class UpsertPreferenceDto {
  @IsString()
  @IsIn([...NOTIFICATION_EVENT_TYPES])
  eventType!: string;

  @IsOptional()
  @IsBoolean()
  email?: boolean;

  @IsOptional()
  @IsBoolean()
  sms?: boolean;

  @IsOptional()
  @IsBoolean()
  push?: boolean;

  @IsOptional()
  @IsBoolean()
  inApp?: boolean;
}

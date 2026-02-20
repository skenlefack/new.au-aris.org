import {
  IsArray,
  IsString,
  IsUUID,
  IsOptional,
  IsObject,
  IsNumber,
  IsInt,
  IsDateString,
  IsEnum,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DataClassification } from '@aris/shared-types';

export class SubmissionPayload {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsUUID()
  campaignId!: string;

  @IsObject()
  data!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  deviceId?: string;

  @IsOptional()
  @IsNumber()
  gpsLat?: number;

  @IsOptional()
  @IsNumber()
  gpsLng?: number;

  @IsOptional()
  @IsNumber()
  gpsAccuracy?: number;

  @IsOptional()
  @IsDateString()
  offlineCreatedAt?: string;

  @IsOptional()
  @IsEnum(DataClassification)
  dataClassification?: DataClassification;

  @IsOptional()
  @IsInt()
  version?: number;
}

export class SyncRequestDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubmissionPayload)
  submissions!: SubmissionPayload[];

  @IsDateString()
  lastSyncAt!: string;
}

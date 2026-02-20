import { IsString, IsEnum, IsOptional, IsObject } from 'class-validator';
import { DataClassification } from '@aris/shared-types';

export class UploadFileDto {
  @IsEnum(DataClassification)
  classification!: DataClassification;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

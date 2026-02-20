import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsDateString,
} from 'class-validator';
import { DataClassification } from '@aris/shared-types';
import { FrameworkType, FrameworkStatus } from '../entities/legal-framework.entity';

export class UpdateLegalFrameworkDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsEnum(FrameworkType)
  type?: FrameworkType;

  @IsOptional()
  @IsString()
  domain?: string;

  @IsOptional()
  @IsDateString()
  adoptionDate?: string;

  @IsOptional()
  @IsEnum(FrameworkStatus)
  status?: FrameworkStatus;

  @IsOptional()
  @IsUUID()
  documentFileId?: string;

  @IsOptional()
  @IsEnum(DataClassification)
  dataClassification?: DataClassification;
}

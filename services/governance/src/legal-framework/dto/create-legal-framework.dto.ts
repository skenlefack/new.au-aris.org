import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsDateString,
} from 'class-validator';
import { DataClassification } from '@aris/shared-types';
import { FrameworkType, FrameworkStatus } from '../entities/legal-framework.entity';

export class CreateLegalFrameworkDto {
  @IsString()
  title!: string;

  @IsEnum(FrameworkType)
  type!: FrameworkType;

  @IsString()
  domain!: string;

  @IsOptional()
  @IsDateString()
  adoptionDate?: string;

  @IsEnum(FrameworkStatus)
  status!: FrameworkStatus;

  @IsOptional()
  @IsUUID()
  documentFileId?: string;

  @IsOptional()
  @IsEnum(DataClassification)
  dataClassification?: DataClassification;
}

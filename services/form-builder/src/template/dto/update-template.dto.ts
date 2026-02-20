import {
  IsString,
  IsOptional,
  IsUUID,
  IsObject,
  IsEnum,
  MaxLength,
  MinLength,
} from 'class-validator';
import { DataClassification } from '@aris/shared-types';

export class UpdateTemplateDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  domain?: string;

  @IsOptional()
  @IsObject()
  schema?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  uiSchema?: Record<string, unknown>;

  @IsOptional()
  @IsUUID()
  dataContractId?: string;

  @IsOptional()
  @IsEnum(DataClassification)
  dataClassification?: DataClassification;
}

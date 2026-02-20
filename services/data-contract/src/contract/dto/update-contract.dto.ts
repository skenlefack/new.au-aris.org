import {
  IsString,
  IsEnum,
  IsOptional,
  IsObject,
  IsNumber,
  IsDateString,
  IsUUID,
  MaxLength,
  MinLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DataClassification } from '@aris/shared-types';
import { QualitySlaDto } from './create-contract.dto';

export class UpdateContractDto {
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
  @IsString()
  @MaxLength(255)
  dataOwner?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  dataSteward?: string;

  @IsOptional()
  @IsString()
  purpose?: string;

  @IsOptional()
  @IsEnum(['OFFICIAL', 'ANALYTICAL', 'INTERNAL'] as const)
  officialityLevel?: 'OFFICIAL' | 'ANALYTICAL' | 'INTERNAL';

  @IsOptional()
  @IsObject()
  schema?: Record<string, unknown>;

  @IsOptional()
  @IsEnum(['REALTIME', 'DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL'] as const)
  frequency?: 'REALTIME' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';

  @IsOptional()
  @IsNumber()
  @Min(1)
  timelinessSla?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => QualitySlaDto)
  qualitySla?: QualitySlaDto;

  @IsOptional()
  @IsEnum(DataClassification)
  classification?: DataClassification;

  @IsOptional()
  @IsEnum(['API', 'KAFKA', 'BATCH', 'MANUAL'] as const)
  exchangeMechanism?: 'API' | 'KAFKA' | 'BATCH' | 'MANUAL';

  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validTo?: string;

  @IsOptional()
  @IsUUID()
  approvedBy?: string;
}

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

export class QualitySlaDto {
  @IsNumber()
  @Min(1)
  correctionDeadline!: number;

  @IsNumber()
  @Min(1)
  escalationDeadline!: number;

  @IsNumber()
  @Min(0)
  minPassRate!: number;
}

export class CreateContractDto {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  domain!: string;

  @IsString()
  @MaxLength(255)
  dataOwner!: string;

  @IsString()
  @MaxLength(255)
  dataSteward!: string;

  @IsString()
  purpose!: string;

  @IsEnum(['OFFICIAL', 'ANALYTICAL', 'INTERNAL'] as const)
  officialityLevel!: 'OFFICIAL' | 'ANALYTICAL' | 'INTERNAL';

  @IsObject()
  schema!: Record<string, unknown>;

  @IsEnum(['REALTIME', 'DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL'] as const)
  frequency!: 'REALTIME' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';

  @IsNumber()
  @Min(1)
  timelinessSla!: number;

  @ValidateNested()
  @Type(() => QualitySlaDto)
  qualitySla!: QualitySlaDto;

  @IsEnum(DataClassification)
  classification!: DataClassification;

  @IsEnum(['API', 'KAFKA', 'BATCH', 'MANUAL'] as const)
  exchangeMechanism!: 'API' | 'KAFKA' | 'BATCH' | 'MANUAL';

  @IsDateString()
  validFrom!: string;

  @IsOptional()
  @IsDateString()
  validTo?: string;

  @IsUUID()
  approvedBy!: string;
}

import {
  IsString,
  IsEnum,
  IsOptional,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { DataClassification } from '@aris/shared-types';

export class PresignDto {
  @IsString()
  @MaxLength(500)
  filename!: string;

  @IsString()
  @MaxLength(255)
  mimeType!: string;

  @IsInt()
  @Min(1)
  @Max(5_368_709_120) // 5 GB
  size!: number;

  @IsEnum(DataClassification)
  classification!: DataClassification;

  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(86400)
  expiresIn?: number;
}

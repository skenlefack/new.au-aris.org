import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsInt,
  MaxLength,
  Matches,
  Min,
  Max,
} from 'class-validator';
import type { DenominatorSource } from '../entities/denominator.entity';

export class CreateDenominatorDto {
  @IsString()
  @MaxLength(3)
  @Matches(/^[A-Z]{2,3}$/, { message: 'countryCode must be ISO 3166 alpha-2 or alpha-3' })
  countryCode!: string;

  @IsOptional()
  @IsUUID()
  geoEntityId?: string;

  @IsUUID()
  speciesId!: string;

  @IsInt()
  @Min(1900)
  @Max(2100)
  year!: number;

  @IsEnum(['FAOSTAT', 'NATIONAL_CENSUS', 'ESTIMATE'] as const)
  source!: DenominatorSource;

  @IsInt()
  @Min(0)
  population!: number;

  @IsOptional()
  @IsString()
  assumptions?: string;
}

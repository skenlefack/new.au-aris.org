import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class FaostatDenominatorRow {
  @IsString()
  @MaxLength(3)
  countryCode!: string;

  @IsString()
  @MaxLength(50)
  speciesCode!: string;

  @IsNumber()
  @Min(1900)
  @Max(2100)
  year!: number;

  @IsNumber()
  @Min(0)
  population!: number;

  @IsOptional()
  @IsString()
  source?: string;
}

export class CreateFaostatSyncDto {
  /** ISO 3166 country code */
  @IsString()
  @MaxLength(3)
  countryCode!: string;

  /** Year of the FAOSTAT data */
  @IsNumber()
  @Min(1900)
  @Max(2100)
  year!: number;

  /** Denominator records to import */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FaostatDenominatorRow)
  records!: FaostatDenominatorRow[];

  /** Optional source URL */
  @IsOptional()
  @IsString()
  sourceUrl?: string;
}

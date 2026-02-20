import {
  IsString,
  IsDateString,
  IsOptional,
  IsEnum,
  MaxLength,
} from 'class-validator';

export class CreateWahisExportDto {
  /** ISO 3166 country code */
  @IsString()
  @MaxLength(3)
  countryCode!: string;

  /** Start of export period (ISO 8601) */
  @IsDateString()
  periodStart!: string;

  /** End of export period (ISO 8601) */
  @IsDateString()
  periodEnd!: string;

  /** Export format */
  @IsOptional()
  @IsEnum(['WOAH_JSON', 'WOAH_XML'] as const)
  format?: 'WOAH_JSON' | 'WOAH_XML';
}

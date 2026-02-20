import {
  IsString,
  IsOptional,
  IsDateString,
  IsUUID,
  IsEnum,
} from 'class-validator';

export class RiskMapQueryDto {
  /** Disease ID from Master Data */
  @IsUUID()
  diseaseId!: string;

  /** Start of period (ISO 8601) */
  @IsDateString()
  periodStart!: string;

  /** End of period (ISO 8601) */
  @IsDateString()
  periodEnd!: string;

  /** Optional country code filter (ISO 3166 alpha-2/3) */
  @IsOptional()
  @IsString()
  countryCode?: string;

  /** Admin level for aggregation: ADMIN1 or ADMIN2 (default ADMIN2) */
  @IsOptional()
  @IsEnum(['ADMIN1', 'ADMIN2'] as const)
  adminLevel?: 'ADMIN1' | 'ADMIN2';
}

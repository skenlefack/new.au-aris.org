import {
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Max,
} from 'class-validator';

export class NearestQueryDto {
  /** Latitude of the reference point */
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  /** Longitude of the reference point */
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;

  /** Admin boundary level filter: COUNTRY, ADMIN1, ADMIN2, ADMIN3 */
  @IsOptional()
  @IsString()
  level?: string;

  /** Maximum search distance in meters */
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxDistance?: number;

  /** Maximum results to return */
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}

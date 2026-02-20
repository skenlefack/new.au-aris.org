import {
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Max,
} from 'class-validator';

export class WithinQueryDto {
  /** Minimum longitude (west) */
  @IsNumber()
  @Min(-180)
  @Max(180)
  minLng!: number;

  /** Minimum latitude (south) */
  @IsNumber()
  @Min(-90)
  @Max(90)
  minLat!: number;

  /** Maximum longitude (east) */
  @IsNumber()
  @Min(-180)
  @Max(180)
  maxLng!: number;

  /** Maximum latitude (north) */
  @IsNumber()
  @Min(-90)
  @Max(90)
  maxLat!: number;

  /** Admin boundary level filter: COUNTRY, ADMIN1, ADMIN2, ADMIN3 */
  @IsOptional()
  @IsString()
  level?: string;

  /** Maximum results to return */
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(500)
  limit?: number;
}

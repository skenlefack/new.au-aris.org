import {
  IsNumber,
  Min,
  Max,
} from 'class-validator';

export class ContainsQueryDto {
  /** Latitude of the point */
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  /** Longitude of the point */
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;
}

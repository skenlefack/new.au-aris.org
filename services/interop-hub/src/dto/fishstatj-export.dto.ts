import {
  IsString,
  IsNumber,
  MaxLength,
  Min,
  Max,
} from 'class-validator';

export class CreateFishstatjExportDto {
  /** ISO 3166 country code */
  @IsString()
  @MaxLength(3)
  countryCode!: string;

  /** Year to export */
  @IsNumber()
  @Min(1900)
  @Max(2100)
  year!: number;
}

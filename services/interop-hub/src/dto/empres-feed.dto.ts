import {
  IsString,
  IsUUID,
  IsOptional,
  IsNumber,
  IsArray,
  MaxLength,
  IsObject,
} from 'class-validator';

export class CreateEmpresFeedDto {
  /** Health event ID to push as EMPRES signal */
  @IsUUID()
  healthEventId!: string;

  /** Disease code (WOAH-aligned) */
  @IsString()
  @MaxLength(50)
  diseaseCode!: string;

  /** ISO 3166 country code */
  @IsString()
  @MaxLength(3)
  countryCode!: string;

  /** Confidence level: RUMOR, VERIFIED, CONFIRMED */
  @IsString()
  @MaxLength(20)
  confidenceLevel!: string;

  /** Context/description of the signal */
  @IsString()
  context!: string;

  /** Coordinates of the event */
  @IsOptional()
  @IsObject()
  coordinates?: { lat: number; lng: number };

  /** Affected species codes */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  species?: string[];

  /** Number of cases */
  @IsOptional()
  @IsNumber()
  cases?: number;

  /** Number of deaths */
  @IsOptional()
  @IsNumber()
  deaths?: number;
}

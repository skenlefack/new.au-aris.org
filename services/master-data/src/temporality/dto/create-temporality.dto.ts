import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsDateString,
  MaxLength,
  MinLength,
  Min,
  Max,
  Matches,
} from 'class-validator';

export class CreateTemporalityDto {
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  nameEn!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  nameFr!: string;

  @IsString()
  @MaxLength(50)
  calendarType!: string;

  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;

  @IsInt()
  @Min(1900)
  @Max(2100)
  year!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(53)
  weekNumber?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  monthNumber?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4)
  quarterNumber?: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  @Matches(/^[A-Z]{2,3}$/, { message: 'countryCode must be ISO 3166 alpha-2 or alpha-3' })
  countryCode?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

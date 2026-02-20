import {
  IsString,
  IsOptional,
  IsInt,
  Min,
} from 'class-validator';

export class UpdateDenominatorDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  population?: number;

  @IsOptional()
  @IsString()
  assumptions?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

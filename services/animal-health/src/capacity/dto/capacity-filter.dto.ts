import { IsOptional, IsNumber, Min, Max } from 'class-validator';

export class CapacityFilterDto {
  @IsOptional()
  @IsNumber()
  @Min(2000)
  @Max(2100)
  year?: number;
}

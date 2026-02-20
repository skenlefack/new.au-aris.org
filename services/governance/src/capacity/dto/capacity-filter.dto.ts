import { IsOptional, IsNumber, IsString } from 'class-validator';

export class CapacityFilterDto {
  @IsOptional()
  @IsNumber()
  year?: number;

  @IsOptional()
  @IsString()
  organizationName?: string;
}

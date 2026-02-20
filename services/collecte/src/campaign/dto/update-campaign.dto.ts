import {
  IsString,
  IsOptional,
  IsInt,
  IsArray,
  IsUUID,
  IsEnum,
  IsDateString,
  MaxLength,
  MinLength,
  Min,
} from 'class-validator';

export class UpdateCampaignDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  targetZones?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  assignedAgents?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  targetSubmissions?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(['PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED'])
  status?: 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

  @IsOptional()
  @IsEnum(['LAST_WRITE_WINS', 'MANUAL_MERGE'])
  conflictStrategy?: 'LAST_WRITE_WINS' | 'MANUAL_MERGE';
}

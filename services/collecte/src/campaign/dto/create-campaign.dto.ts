import {
  IsString,
  IsUUID,
  IsOptional,
  IsInt,
  IsArray,
  IsEnum,
  IsDateString,
  MaxLength,
  MinLength,
  Min,
} from 'class-validator';

export class CreateCampaignDto {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  domain!: string;

  @IsUUID()
  templateId!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsArray()
  @IsUUID(undefined, { each: true })
  targetZones!: string[];

  @IsArray()
  @IsUUID(undefined, { each: true })
  assignedAgents!: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  targetSubmissions?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(['LAST_WRITE_WINS', 'MANUAL_MERGE'])
  conflictStrategy?: 'LAST_WRITE_WINS' | 'MANUAL_MERGE';

  @IsOptional()
  @IsUUID()
  dataContractId?: string;
}

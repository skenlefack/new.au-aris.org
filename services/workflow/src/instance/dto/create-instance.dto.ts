import {
  IsString,
  IsOptional,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateInstanceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  entityType!: string;

  @IsUUID()
  entityId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  domain!: string;

  @IsOptional()
  @IsUUID()
  dataContractId?: string;

  @IsOptional()
  @IsString()
  qualityReportId?: string;
}

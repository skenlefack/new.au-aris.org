import {
  IsString,
  IsObject,
  IsOptional,
  IsUUID,
  IsArray,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ValidateRecordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  recordId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  entityType!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  domain!: string;

  @IsObject()
  record!: Record<string, unknown>;

  @IsOptional()
  @IsUUID()
  dataContractId?: string;

  @IsOptional()
  @IsObject()
  gateConfig?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredFields?: string[];

  @IsOptional()
  @IsArray()
  temporalPairs?: [string, string][];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  geoFields?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  unitFields?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  auditFields?: string[];

  @IsOptional()
  @IsObject()
  codeFields?: Record<string, string>;

  @IsOptional()
  @IsString()
  confidenceLevelField?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  confidenceEvidenceFields?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dedupFields?: string[];
}

import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsObject,
  IsUUID,
  MaxLength,
} from 'class-validator';

/** Body for API Push ingestion — country pushes records to ARIS */
export class PushIngestionDto {
  @IsString()
  @MaxLength(50)
  domain!: string;

  @IsString()
  @MaxLength(50)
  entityType!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  sourceSystem?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  sourceVersion?: string;

  @IsArray()
  records!: Record<string, unknown>[];

  @IsOptional()
  @IsString()
  mappingProfile?: string;
}

/** Body for File Upload ingestion — structured file deposit */
export class FileUploadIngestionDto {
  @IsString()
  @MaxLength(50)
  domain!: string;

  @IsString()
  @MaxLength(50)
  entityType!: string;

  @IsString()
  @MaxLength(3)
  countryCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  period?: string;

  @IsOptional()
  @IsString()
  mappingProfile?: string;
}

/** Body for triggering a manual API Pull */
export class TriggerPullDto {
  @IsUUID()
  connectionId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  domain?: string;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;
}

/** Body for creating/updating referential mappings in bulk */
export class BulkMappingDto {
  @IsUUID()
  connectionId!: string;

  @IsString()
  @MaxLength(50)
  referentialType!: string;

  @IsArray()
  mappings!: Array<{
    sourceCode: string;
    sourceLabel?: string;
    targetCode: string;
    targetLabel?: string;
    targetId?: string;
  }>;
}

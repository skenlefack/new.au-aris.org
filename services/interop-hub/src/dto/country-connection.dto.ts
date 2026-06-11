import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsObject,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateCountryConnectionDto {
  @IsString()
  @MaxLength(3)
  countryCode!: string;

  @IsString()
  @MaxLength(100)
  countryName!: string;

  @IsEnum(['API_PUSH', 'API_PULL', 'FILE_UPLOAD'] as const)
  integrationModel!: 'API_PUSH' | 'API_PULL' | 'FILE_UPLOAD';

  @IsString()
  @MaxLength(255)
  systemName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  systemType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  baseUrl?: string;

  @IsOptional()
  @IsEnum(['BASIC', 'OAUTH2', 'API_KEY', 'CERTIFICATE'] as const)
  authType?: string;

  @IsOptional()
  @IsObject()
  credentials?: Record<string, unknown>;

  @IsArray()
  @IsString({ each: true })
  domains!: string[];

  @IsOptional()
  @IsEnum(['REALTIME', 'HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY'] as const)
  syncFrequency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  syncTime?: string;

  @IsOptional()
  @IsObject()
  pullConfig?: Record<string, unknown>;

  @IsOptional()
  @IsUUID()
  dataContractId?: string;

  @IsOptional()
  @IsObject()
  focalTechnical?: { name: string; email: string; phone?: string };

  @IsOptional()
  @IsObject()
  focalDataOwner?: { name: string; email: string; phone?: string };

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateCountryConnectionDto {
  @IsOptional()
  @IsEnum(['API_PUSH', 'API_PULL', 'FILE_UPLOAD'] as const)
  integrationModel?: 'API_PUSH' | 'API_PULL' | 'FILE_UPLOAD';

  @IsOptional()
  @IsString()
  @MaxLength(255)
  systemName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  systemType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  baseUrl?: string;

  @IsOptional()
  @IsEnum(['BASIC', 'OAUTH2', 'API_KEY', 'CERTIFICATE'] as const)
  authType?: string;

  @IsOptional()
  @IsObject()
  credentials?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  domains?: string[];

  @IsOptional()
  @IsEnum(['REALTIME', 'HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY'] as const)
  syncFrequency?: string;

  @IsOptional()
  @IsString()
  syncTime?: string;

  @IsOptional()
  @IsObject()
  pullConfig?: Record<string, unknown>;

  @IsOptional()
  @IsEnum(['DRAFT', 'ACTIVE', 'SUSPENDED', 'ARCHIVED'] as const)
  status?: 'DRAFT' | 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';

  @IsOptional()
  @IsUUID()
  dataContractId?: string;

  @IsOptional()
  @IsObject()
  focalTechnical?: { name: string; email: string; phone?: string };

  @IsOptional()
  @IsObject()
  focalDataOwner?: { name: string; email: string; phone?: string };

  @IsOptional()
  @IsString()
  notes?: string;
}

import {
  IsString,
  IsEnum,
  IsOptional,
  IsDateString,
  IsUUID,
  IsNumber,
  Min,
} from 'class-validator';
import { DataClassification } from '@aris/shared-types';
import type { InspectionResult, CertificateStatus } from '../entities/sps-certificate.entity';

export class UpdateSpsCertificateDto {
  @IsOptional()
  @IsString()
  certificateNumber?: string;

  @IsOptional()
  @IsString()
  consignmentId?: string;

  @IsOptional()
  @IsUUID()
  exporterId?: string;

  @IsOptional()
  @IsUUID()
  importerId?: string;

  @IsOptional()
  @IsUUID()
  speciesId?: string;

  @IsOptional()
  @IsString()
  commodity?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsUUID()
  originCountryId?: string;

  @IsOptional()
  @IsUUID()
  destinationCountryId?: string;

  @IsOptional()
  @IsEnum(['PASS', 'FAIL', 'CONDITIONAL', 'PENDING'] as const)
  inspectionResult?: InspectionResult;

  @IsOptional()
  @IsDateString()
  inspectionDate?: string;

  @IsOptional()
  @IsUUID()
  certifiedBy?: string;

  @IsOptional()
  @IsDateString()
  certifiedAt?: string;

  @IsOptional()
  @IsEnum(['DRAFT', 'ISSUED', 'REVOKED', 'EXPIRED'] as const)
  status?: CertificateStatus;

  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsEnum(DataClassification)
  dataClassification?: DataClassification;
}

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

export class CreateSpsCertificateDto {
  @IsString()
  certificateNumber!: string;

  @IsString()
  consignmentId!: string;

  @IsUUID()
  exporterId!: string;

  @IsUUID()
  importerId!: string;

  @IsUUID()
  speciesId!: string;

  @IsString()
  commodity!: string;

  @IsNumber()
  @Min(0)
  quantity!: number;

  @IsString()
  unit!: string;

  @IsUUID()
  originCountryId!: string;

  @IsUUID()
  destinationCountryId!: string;

  @IsEnum(['PASS', 'FAIL', 'CONDITIONAL', 'PENDING'] as const)
  inspectionResult!: InspectionResult;

  @IsDateString()
  inspectionDate!: string;

  @IsUUID()
  certifiedBy!: string;

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

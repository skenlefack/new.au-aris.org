import type { DataClassification } from '@aris/shared-types';

export type FormTemplateStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

/**
 * ARIS domain-specific form component types beyond standard JSON Schema.
 * These map to specialized UI widgets in the frontend.
 */
export type ArisComponentType =
  | 'geo-picker'
  | 'species-selector'
  | 'disease-selector'
  | 'admin-cascader'
  | 'photo-capture'
  | 'signature-pad'
  | 'lab-result-panel';

/**
 * Reference type matching the Prisma FormTemplate model.
 */
export interface FormTemplateEntity {
  id: string;
  tenantId: string;
  name: string;
  domain: string;
  version: number;
  parentTemplateId: string | null;
  schema: unknown;
  uiSchema: unknown;
  dataContractId: string | null;
  status: FormTemplateStatus;
  dataClassification: DataClassification;
  createdBy: string;
  updatedBy: string | null;
  publishedAt: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

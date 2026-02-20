import type { DataClassification } from '@aris/shared-types';

/**
 * Reference type matching the Prisma Publication model.
 * Used for typing service/controller return values without
 * coupling to the Prisma-generated types in non-DB layers.
 */
export interface PublicationEntity {
  id: string;
  tenantId: string;
  title: string;
  abstract: string | null;
  authors: string[];
  domain: string;
  type: string; // BRIEF | REPORT | GUIDELINE | BULLETIN
  fileId: string | null;
  publishedAt: Date | null;
  tags: string[];
  language: string; // EN | FR
  dataClassification: DataClassification;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

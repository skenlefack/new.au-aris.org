export interface FaqEntity {
  id: string;
  tenantId: string;
  question: string;
  answer: string;
  domain: string;
  language: string;
  sortOrder: number;
  dataClassification: string;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ELearningModuleEntity {
  id: string;
  tenantId: string;
  title: string;
  description: string | null;
  domain: string;
  lessons: unknown; // JSON array
  estimatedDuration: number; // minutes
  prerequisiteIds: string[];
  publishedAt: Date | null;
  dataClassification: string;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

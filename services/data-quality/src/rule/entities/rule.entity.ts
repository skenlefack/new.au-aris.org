export interface RuleEntity {
  id: string;
  domain: string;
  entityType: string;
  tenantId: string;
  name: string;
  description: string | null;
  gate: string;
  config: unknown;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

import { randomUUID } from 'crypto';

export interface MockSubmission {
  id: string;
  tenantId: string;
  templateId: string;
  campaignId: string | null;
  data: Record<string, unknown>;
  status: 'DRAFT' | 'SUBMITTED' | 'VALIDATED' | 'REJECTED' | 'APPROVED';
  submittedBy: string;
  submittedAt: string | null;
  validatedBy: string | null;
  validatedAt: string | null;
  sourceSystem: string;
  responsibleUnit: string;
  validationStatus: string;
  dataClassification: string;
  createdAt: string;
  updatedAt: string;
}

export function createMockSubmission(
  overrides: Partial<MockSubmission> = {},
): MockSubmission {
  const id = overrides.id ?? randomUUID();
  return {
    id,
    tenantId: randomUUID(),
    templateId: randomUUID(),
    campaignId: null,
    data: {
      speciesCode: 'BOV',
      countryCode: 'KE',
      reportDate: '2024-01-15',
      affectedCount: 50,
    },
    status: 'DRAFT',
    submittedBy: randomUUID(),
    submittedAt: null,
    validatedBy: null,
    validatedAt: null,
    sourceSystem: 'ARIS',
    responsibleUnit: 'CVO-KE',
    validationStatus: 'DRAFT',
    dataClassification: 'RESTRICTED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

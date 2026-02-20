import { randomUUID } from 'crypto';

export interface MockHealthEvent {
  id: string;
  tenantId: string;
  speciesCode: string;
  diseaseCode: string;
  countryCode: string;
  adminCode: string;
  latitude: number;
  longitude: number;
  suspicionDate: string;
  confirmationDate: string | null;
  closureDate: string | null;
  confidenceLevel: 'RUMOR' | 'VERIFIED' | 'CONFIRMED';
  status: 'SUSPECTED' | 'CONFIRMED' | 'RESOLVED' | 'DENIED';
  affectedCount: number;
  deadCount: number;
  quantityUnit: string;
  labResult: string | null;
  fieldInvestigation: boolean;
  sourceSystem: string;
  responsibleUnit: string;
  validationStatus: string;
  dataClassification: string;
  createdAt: string;
  updatedAt: string;
}

export function createMockHealthEvent(
  overrides: Partial<MockHealthEvent> = {},
): MockHealthEvent {
  const id = overrides.id ?? randomUUID();
  return {
    id,
    tenantId: randomUUID(),
    speciesCode: 'BOV',
    diseaseCode: 'FMD',
    countryCode: 'KE',
    adminCode: 'KE-30',
    latitude: -1.2864,
    longitude: 36.8172,
    suspicionDate: '2024-01-01',
    confirmationDate: '2024-01-10',
    closureDate: null,
    confidenceLevel: 'CONFIRMED',
    status: 'CONFIRMED',
    affectedCount: 150,
    deadCount: 12,
    quantityUnit: 'HEAD',
    labResult: 'POSITIVE',
    fieldInvestigation: true,
    sourceSystem: 'ARIS',
    responsibleUnit: 'CVO-KE',
    validationStatus: 'DRAFT',
    dataClassification: 'RESTRICTED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

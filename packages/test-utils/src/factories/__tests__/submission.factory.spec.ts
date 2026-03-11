import { describe, it, expect } from 'vitest';
import { createMockSubmission } from '../submission.factory';

describe('createMockSubmission', () => {
  it('should return a submission with all required fields', () => {
    const sub = createMockSubmission();

    expect(sub.id).toBeDefined();
    expect(sub.tenantId).toBeDefined();
    expect(sub.templateId).toBeDefined();
    expect(sub.campaignId).toBeNull();
    expect(sub.data).toBeDefined();
    expect(sub.data).toHaveProperty('speciesCode');
    expect(sub.status).toBe('DRAFT');
    expect(sub.submittedBy).toBeDefined();
    expect(sub.submittedAt).toBeNull();
    expect(sub.validatedBy).toBeNull();
    expect(sub.validatedAt).toBeNull();
    expect(sub.sourceSystem).toBe('ARIS');
    expect(sub.responsibleUnit).toBe('CVO-KE');
    expect(sub.validationStatus).toBe('DRAFT');
    expect(sub.dataClassification).toBe('RESTRICTED');
  });

  it('should generate unique IDs on each call', () => {
    const s1 = createMockSubmission();
    const s2 = createMockSubmission();

    expect(s1.id).not.toBe(s2.id);
    expect(s1.tenantId).not.toBe(s2.tenantId);
    expect(s1.templateId).not.toBe(s2.templateId);
    expect(s1.submittedBy).not.toBe(s2.submittedBy);
  });

  it('should allow overriding fields', () => {
    const sub = createMockSubmission({
      status: 'SUBMITTED',
      submittedAt: '2024-02-01T10:00:00.000Z',
      campaignId: '00000000-0000-0000-0000-000000000099',
      data: { customField: 'value' },
    });

    expect(sub.status).toBe('SUBMITTED');
    expect(sub.submittedAt).toBe('2024-02-01T10:00:00.000Z');
    expect(sub.campaignId).toBe('00000000-0000-0000-0000-000000000099');
    expect(sub.data).toEqual({ customField: 'value' });
  });

  it('should have valid ISO date strings for timestamps', () => {
    const sub = createMockSubmission();

    expect(() => new Date(sub.createdAt)).not.toThrow();
    expect(() => new Date(sub.updatedAt)).not.toThrow();
    expect(new Date(sub.createdAt).toISOString()).toBe(sub.createdAt);
  });

  it('should preserve defaults when overriding specific fields', () => {
    const sub = createMockSubmission({ status: 'VALIDATED' });

    expect(sub.status).toBe('VALIDATED');
    expect(sub.sourceSystem).toBe('ARIS');
    expect(sub.responsibleUnit).toBe('CVO-KE');
    expect(sub.dataClassification).toBe('RESTRICTED');
  });
});

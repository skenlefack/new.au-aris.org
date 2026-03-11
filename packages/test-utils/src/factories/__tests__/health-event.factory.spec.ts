import { describe, it, expect } from 'vitest';
import { createMockHealthEvent } from '../health-event.factory';

describe('createMockHealthEvent', () => {
  it('should return a health event with all required fields', () => {
    const event = createMockHealthEvent();

    expect(event.id).toBeDefined();
    expect(event.tenantId).toBeDefined();
    expect(event.speciesCode).toBe('BOV');
    expect(event.diseaseCode).toBe('FMD');
    expect(event.countryCode).toBe('KE');
    expect(event.adminCode).toBe('KE-30');
    expect(event.latitude).toBeCloseTo(-1.2864);
    expect(event.longitude).toBeCloseTo(36.8172);
    expect(event.confidenceLevel).toBe('CONFIRMED');
    expect(event.status).toBe('CONFIRMED');
    expect(event.affectedCount).toBe(150);
    expect(event.deadCount).toBe(12);
    expect(event.quantityUnit).toBe('HEAD');
    expect(event.labResult).toBe('POSITIVE');
    expect(event.fieldInvestigation).toBe(true);
    expect(event.sourceSystem).toBe('ARIS');
    expect(event.responsibleUnit).toBe('CVO-KE');
    expect(event.validationStatus).toBe('DRAFT');
    expect(event.dataClassification).toBe('RESTRICTED');
  });

  it('should generate unique IDs on each call', () => {
    const e1 = createMockHealthEvent();
    const e2 = createMockHealthEvent();

    expect(e1.id).not.toBe(e2.id);
    expect(e1.tenantId).not.toBe(e2.tenantId);
  });

  it('should allow overriding fields', () => {
    const event = createMockHealthEvent({
      speciesCode: 'OVI',
      diseaseCode: 'PPR',
      countryCode: 'ET',
      status: 'SUSPECTED',
      confidenceLevel: 'RUMOR',
      affectedCount: 500,
      deadCount: 25,
    });

    expect(event.speciesCode).toBe('OVI');
    expect(event.diseaseCode).toBe('PPR');
    expect(event.countryCode).toBe('ET');
    expect(event.status).toBe('SUSPECTED');
    expect(event.confidenceLevel).toBe('RUMOR');
    expect(event.affectedCount).toBe(500);
    expect(event.deadCount).toBe(25);
  });

  it('should have valid ISO date strings for timestamps', () => {
    const event = createMockHealthEvent();

    expect(event.suspicionDate).toBe('2024-01-01');
    expect(event.confirmationDate).toBe('2024-01-10');
    expect(event.closureDate).toBeNull();

    // createdAt and updatedAt should be valid ISO strings
    expect(() => new Date(event.createdAt)).not.toThrow();
    expect(() => new Date(event.updatedAt)).not.toThrow();
    expect(new Date(event.createdAt).toISOString()).toBe(event.createdAt);
  });

  it('should allow setting closure date', () => {
    const event = createMockHealthEvent({
      closureDate: '2024-02-15',
      status: 'RESOLVED',
    });

    expect(event.closureDate).toBe('2024-02-15');
    expect(event.status).toBe('RESOLVED');
  });

  it('should preserve default fields when overriding specific ones', () => {
    const event = createMockHealthEvent({ affectedCount: 999 });

    expect(event.affectedCount).toBe(999);
    expect(event.speciesCode).toBe('BOV');
    expect(event.diseaseCode).toBe('FMD');
    expect(event.sourceSystem).toBe('ARIS');
  });
});

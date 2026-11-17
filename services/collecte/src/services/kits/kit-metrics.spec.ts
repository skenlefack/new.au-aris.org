import { describe, it, expect } from 'vitest';
import { deriveMetrics, linkHistory, type KitRequestRow, type KitShipmentRow } from './kit-metrics';

const NOW = new Date('2027-03-01T00:00:00Z');

function req(over: Partial<KitRequestRow> = {}): KitRequestRow {
  return {
    id: 'r1', countryCode: 'UG', status: 'SUBMITTED', quantityRequested: 10, quantityApproved: null,
    requestedAt: '2027-02-01T08:00:00Z', decidedAt: null, availableFrom: null, availableTo: null,
    desiredDate: null, isHistorical: false, ...over,
  };
}
function ship(over: Partial<KitShipmentRow> = {}): KitShipmentRow {
  return {
    id: 's1', requestId: 'r1', countryCode: 'UG', shippedAt: '2027-02-20', quantity: 4, kitFormat: 'F10',
    numSamples: null, receivedAt: null, quantityReceived: null, condition: null, isHistorical: false, ...over,
  };
}

describe('deriveMetrics', () => {
  it('pending request past 15 days is out of SLA and counts its waiting time', () => {
    const m = deriveMetrics(req(), [], NOW);
    expect(m.stage).toBe('PENDING_DECISION');
    expect(m.decisionDays).toBe(28);
    expect(m.waitingDays).toBe(28);
    expect(m.decisionWithinSla).toBe(false);
  });

  it('pending request within 15 days has no SLA verdict yet', () => {
    const m = deriveMetrics(req({ requestedAt: '2027-02-20T00:00:00Z' }), [], NOW);
    expect(m.decisionWithinSla).toBeNull();
  });

  it('partial approval with one shipment: gaps at each step', () => {
    const m = deriveMetrics(
      req({ status: 'PARTIAL', quantityApproved: 6, decidedAt: '2027-02-10T00:00:00Z', availableTo: '2027-02-28' }),
      [ship()], NOW,
    );
    expect(m.stage).toBe('PARTIALLY_SHIPPED');
    expect(m.decisionDays).toBe(9);
    expect(m.decisionWithinSla).toBe(true);
    expect(m.gapRequestedApproved).toBe(4);
    expect(m.gapApprovedShipped).toBe(2);
    expect(m.gapShippedReceived).toBe(4);
    expect(m.shipmentDays).toBe(10);
    expect(m.shippedOnTime).toBe(true);
  });

  it('fully shipped and confirmed is RECEIVED with total and delivery times', () => {
    const m = deriveMetrics(
      req({ status: 'APPROVED', quantityApproved: 4, decidedAt: '2027-02-05T00:00:00Z', availableTo: '2027-02-15' }),
      [ship({ receivedAt: '2027-02-25', quantityReceived: 4 })], NOW,
    );
    expect(m.stage).toBe('RECEIVED');
    expect(m.deliveryDays).toBe(5);
    expect(m.totalDays).toBe(24);
    expect(m.shippedOnTime).toBe(false);
    expect(m.gapShippedReceived).toBe(0);
  });

  it('everything shipped but not confirmed is IN_TRANSIT', () => {
    const m = deriveMetrics(req({ status: 'APPROVED', quantityApproved: 4, decidedAt: '2027-02-05T00:00:00Z' }), [ship()], NOW);
    expect(m.stage).toBe('IN_TRANSIT');
    expect(m.waitingDays).toBe(9);
  });

  it('history rows carry no decision delay', () => {
    const m = deriveMetrics(req({ isHistorical: true, status: 'APPROVED' }), [ship({ isHistorical: true })], NOW);
    expect(m.stage).toBe('HISTORICAL');
    expect(m.decisionDays).toBeNull();
    expect(m.shipmentDays).toBe(19);
  });
});

describe('linkHistory', () => {
  it('links shipments to the earliest open earlier request of the same country', () => {
    const links = linkHistory(
      [
        { key: 'a', countryCode: 'MW', requestedAt: '2025-10-10', quantity: 1 },
        { key: 'b', countryCode: 'MW', requestedAt: '2025-11-13', quantity: 5 },
      ],
      [
        { key: 'x', countryCode: 'MW', shippedAt: '2025-06-01', quantity: 1 },
        { key: 'y', countryCode: 'MW', shippedAt: '2026-03-05', quantity: 1 },
        { key: 'z', countryCode: 'MW', shippedAt: '2026-04-01', quantity: 2 },
      ],
    );
    expect(links.get('x')).toBeNull();
    expect(links.get('y')).toBe('a');
    expect(links.get('z')).toBe('b');
  });
});

import { describe, it, expect } from 'vitest';
import { createMockTenant, createMockTenantTree } from '../tenant.factory';
import { TenantLevel } from '@aris/shared-types';

describe('createMockTenant', () => {
  it('should return a tenant with all required fields', () => {
    const tenant = createMockTenant();

    expect(tenant.id).toBeDefined();
    expect(tenant.name).toBeDefined();
    expect(tenant.code).toBe('KE');
    expect(tenant.level).toBe(TenantLevel.MEMBER_STATE);
    expect(tenant.parentId).toBeNull();
    expect(tenant.countryCode).toBe('KE');
    expect(tenant.recCode).toBeNull();
    expect(tenant.domain).toBe('ke.au-aris.org');
    expect(tenant.config).toEqual({});
    expect(tenant.isActive).toBe(true);
    expect(tenant.createdAt).toBeInstanceOf(Date);
    expect(tenant.updatedAt).toBeInstanceOf(Date);
  });

  it('should generate unique IDs on each call', () => {
    const t1 = createMockTenant();
    const t2 = createMockTenant();

    expect(t1.id).not.toBe(t2.id);
  });

  it('should allow overriding fields', () => {
    const tenant = createMockTenant({
      code: 'NG',
      name: 'Nigeria',
      level: TenantLevel.MEMBER_STATE,
      countryCode: 'NG',
    });

    expect(tenant.code).toBe('NG');
    expect(tenant.name).toBe('Nigeria');
    expect(tenant.countryCode).toBe('NG');
  });

  it('should create a continental tenant with overrides', () => {
    const tenant = createMockTenant({
      code: 'AU',
      name: 'African Union',
      level: TenantLevel.CONTINENTAL,
      countryCode: null,
    });

    expect(tenant.level).toBe(TenantLevel.CONTINENTAL);
    expect(tenant.code).toBe('AU');
    expect(tenant.countryCode).toBeNull();
  });

  it('should create a REC tenant with overrides', () => {
    const tenant = createMockTenant({
      code: 'IGAD',
      name: 'IGAD',
      level: TenantLevel.REC,
      recCode: 'IGAD',
      countryCode: null,
    });

    expect(tenant.level).toBe(TenantLevel.REC);
    expect(tenant.recCode).toBe('IGAD');
  });
});

describe('createMockTenantTree', () => {
  it('should create default hierarchy (1 AU + 2 RECs + 4 MS)', () => {
    const tree = createMockTenantTree();

    expect(tree.continental).toBeDefined();
    expect(tree.continental.level).toBe(TenantLevel.CONTINENTAL);
    expect(tree.recs).toHaveLength(2);
    expect(tree.memberStates).toHaveLength(4);
  });

  it('should set parent links correctly', () => {
    const tree = createMockTenantTree();

    // RECs should point to continental
    for (const rec of tree.recs) {
      expect(rec.level).toBe(TenantLevel.REC);
      expect(rec.parentId).toBe(tree.continental.id);
    }

    // Each MS should point to a REC
    for (const ms of tree.memberStates) {
      expect(ms.level).toBe(TenantLevel.MEMBER_STATE);
      expect(ms.parentId).toBeDefined();
      const parentRec = tree.recs.find((r) => r.id === ms.parentId);
      expect(parentRec).toBeDefined();
    }
  });

  it('should respect custom recCount and msPerRec', () => {
    const tree = createMockTenantTree({ recCount: 3, msPerRec: 5 });

    expect(tree.recs).toHaveLength(3);
    expect(tree.memberStates).toHaveLength(15);
  });

  it('should distribute member states evenly across RECs', () => {
    const tree = createMockTenantTree({ recCount: 2, msPerRec: 3 });

    const msPerRec = new Map<string, number>();
    for (const ms of tree.memberStates) {
      const count = msPerRec.get(ms.parentId!) ?? 0;
      msPerRec.set(ms.parentId!, count + 1);
    }

    for (const rec of tree.recs) {
      expect(msPerRec.get(rec.id)).toBe(3);
    }
  });

  it('should generate unique IDs for all tenants', () => {
    const tree = createMockTenantTree();
    const allIds = [
      tree.continental.id,
      ...tree.recs.map((r) => r.id),
      ...tree.memberStates.map((ms) => ms.id),
    ];
    const uniqueIds = new Set(allIds);
    expect(uniqueIds.size).toBe(allIds.length);
  });
});

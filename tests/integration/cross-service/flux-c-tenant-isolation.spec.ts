import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  startPostgresContainer,
  createMockTenantTree,
  createMockJwtPayload,
  createMockHealthEvent,
  type PostgresContainerResult,
} from '@aris/test-utils';
import { UserRole, TenantLevel } from '@aris/shared-types';

describe('Flux C: Credential → Tenant Isolation', () => {
  let postgres: PostgresContainerResult;

  // Seed a tenant hierarchy: AU → 2 RECs → 2 MS each
  const tree = createMockTenantTree({ recCount: 2, msPerRec: 2 });
  const [igad, ecowas] = tree.recs;
  const igadMemberStates = tree.memberStates.filter((ms) => ms.parentId === igad.id);
  const ecowatsMemberStates = tree.memberStates.filter((ms) => ms.parentId === ecowas.id);

  // Create test data scoped to each MS
  const dataStore = new Map<string, ReturnType<typeof createMockHealthEvent>[]>();

  beforeAll(async () => {
    postgres = await startPostgresContainer();

    // Seed data for each member state
    for (const ms of tree.memberStates) {
      const events = [
        createMockHealthEvent({ tenantId: ms.id, countryCode: ms.code }),
        createMockHealthEvent({ tenantId: ms.id, countryCode: ms.code }),
      ];
      dataStore.set(ms.id, events);
    }
  });

  afterAll(async () => {
    await postgres.container.stop();
  });

  it('should have valid test infrastructure', () => {
    expect(postgres.databaseUrl).toContain('postgresql://');
    expect(tree.continental).toBeDefined();
    expect(tree.recs).toHaveLength(2);
    expect(tree.memberStates).toHaveLength(4);
    expect(igadMemberStates).toHaveLength(2);
    expect(ecowatsMemberStates).toHaveLength(2);
  });

  describe('Member State user isolation', () => {
    it('should only see data for their own tenant', () => {
      const ms = igadMemberStates[0];
      const jwt = createMockJwtPayload({
        role: UserRole.NATIONAL_ADMIN,
        tenantId: ms.id,
        tenantLevel: TenantLevel.MEMBER_STATE,
      });

      // Simulate query: filter by tenantId = jwt.tenantId
      const visibleData = filterByTenant(jwt.tenantId, jwt.tenantLevel);

      expect(visibleData).toHaveLength(2); // Only own MS data
      for (const event of visibleData) {
        expect(event.tenantId).toBe(ms.id);
      }
    });

    it('should NOT see data from other member states', () => {
      const ms1 = igadMemberStates[0];
      const ms2 = igadMemberStates[1];

      const jwt = createMockJwtPayload({
        role: UserRole.NATIONAL_ADMIN,
        tenantId: ms1.id,
        tenantLevel: TenantLevel.MEMBER_STATE,
      });

      const visibleData = filterByTenant(jwt.tenantId, jwt.tenantLevel);
      const otherMsData = visibleData.filter((e) => e.tenantId === ms2.id);

      expect(otherMsData).toHaveLength(0);
    });
  });

  describe('REC user visibility', () => {
    it('should see all member states under their REC', () => {
      const jwt = createMockJwtPayload({
        role: UserRole.REC_ADMIN,
        tenantId: igad.id,
        tenantLevel: TenantLevel.REC,
      });

      const visibleData = filterByTenant(jwt.tenantId, jwt.tenantLevel);

      // Should see data from both IGAD member states (2 events each = 4 total)
      expect(visibleData).toHaveLength(4);

      const tenantIds = new Set(visibleData.map((e) => e.tenantId));
      for (const ms of igadMemberStates) {
        expect(tenantIds.has(ms.id)).toBe(true);
      }
    });

    it('should NOT see data from other RECs', () => {
      const jwt = createMockJwtPayload({
        role: UserRole.REC_ADMIN,
        tenantId: igad.id,
        tenantLevel: TenantLevel.REC,
      });

      const visibleData = filterByTenant(jwt.tenantId, jwt.tenantLevel);
      const ecowasData = visibleData.filter((e) =>
        ecowatsMemberStates.some((ms) => ms.id === e.tenantId),
      );

      expect(ecowasData).toHaveLength(0);
    });
  });

  describe('Continental user visibility', () => {
    it('should see data from ALL tenants', () => {
      const jwt = createMockJwtPayload({
        role: UserRole.CONTINENTAL_ADMIN,
        tenantId: tree.continental.id,
        tenantLevel: TenantLevel.CONTINENTAL,
      });

      const visibleData = filterByTenant(jwt.tenantId, jwt.tenantLevel);

      // Should see all data: 4 MS × 2 events = 8 total
      expect(visibleData).toHaveLength(8);

      const tenantIds = new Set(visibleData.map((e) => e.tenantId));
      for (const ms of tree.memberStates) {
        expect(tenantIds.has(ms.id)).toBe(true);
      }
    });
  });

  describe('Cross-REC isolation', () => {
    it('IGAD admin cannot see ECOWAS data', () => {
      const igadJwt = createMockJwtPayload({
        role: UserRole.REC_ADMIN,
        tenantId: igad.id,
        tenantLevel: TenantLevel.REC,
      });

      const igadVisible = filterByTenant(igadJwt.tenantId, igadJwt.tenantLevel);
      const leakedEcowas = igadVisible.filter((e) =>
        ecowatsMemberStates.some((ms) => ms.id === e.tenantId),
      );

      expect(leakedEcowas).toHaveLength(0);
    });

    it('ECOWAS admin cannot see IGAD data', () => {
      const ecowasJwt = createMockJwtPayload({
        role: UserRole.REC_ADMIN,
        tenantId: ecowas.id,
        tenantLevel: TenantLevel.REC,
      });

      const ecowasVisible = filterByTenant(ecowasJwt.tenantId, ecowasJwt.tenantLevel);
      const leakedIgad = ecowasVisible.filter((e) =>
        igadMemberStates.some((ms) => ms.id === e.tenantId),
      );

      expect(leakedIgad).toHaveLength(0);
    });
  });

  /**
   * Simulates tenant-scoped data filtering based on the user's level.
   * - MEMBER_STATE: only their own tenant
   * - REC: all member states under the REC
   * - CONTINENTAL: all data
   */
  function filterByTenant(tenantId: string, level: TenantLevel) {
    const allEvents = Array.from(dataStore.values()).flat();

    switch (level) {
      case TenantLevel.CONTINENTAL:
        return allEvents;

      case TenantLevel.REC: {
        const childMsIds = tree.memberStates
          .filter((ms) => ms.parentId === tenantId)
          .map((ms) => ms.id);
        return allEvents.filter((e) => childMsIds.includes(e.tenantId));
      }

      case TenantLevel.MEMBER_STATE:
        return allEvents.filter((e) => e.tenantId === tenantId);

      default:
        return [];
    }
  }
});

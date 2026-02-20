import { TenantLevel } from '@aris/shared-types';
import { randomUUID } from 'crypto';

export interface MockTenant {
  id: string;
  name: string;
  code: string;
  level: TenantLevel;
  parentId: string | null;
  countryCode: string | null;
  recCode: string | null;
  domain: string;
  config: Record<string, unknown>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function createMockTenant(
  overrides: Partial<MockTenant> = {},
): MockTenant {
  const id = overrides.id ?? randomUUID();
  const code = overrides.code ?? 'KE';
  return {
    id,
    name: `Republic of ${code}`,
    code,
    level: TenantLevel.MEMBER_STATE,
    parentId: null,
    countryCode: code,
    recCode: null,
    domain: `${code.toLowerCase()}.aris.africa`,
    config: {},
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

export interface MockTenantTree {
  continental: MockTenant;
  recs: MockTenant[];
  memberStates: MockTenant[];
}

/**
 * Creates a realistic AU → REC → MS hierarchy.
 * Default: 1 continental, 2 RECs, 2 MS per REC.
 */
export function createMockTenantTree(options?: {
  recCount?: number;
  msPerRec?: number;
}): MockTenantTree {
  const recCount = options?.recCount ?? 2;
  const msPerRec = options?.msPerRec ?? 2;

  const continental = createMockTenant({
    name: 'African Union - IBAR',
    code: 'AU-IBAR',
    level: TenantLevel.CONTINENTAL,
    countryCode: null,
    domain: 'aris.africa',
  });

  const recData = [
    { code: 'IGAD', name: 'IGAD', countries: ['KE', 'ET', 'SO', 'UG', 'DJ'] },
    { code: 'ECOWAS', name: 'ECOWAS', countries: ['NG', 'GH', 'SN', 'CI', 'ML'] },
    { code: 'SADC', name: 'SADC', countries: ['ZA', 'ZW', 'MZ', 'BW', 'TZ'] },
    { code: 'EAC', name: 'EAC', countries: ['KE', 'UG', 'TZ', 'RW', 'BI'] },
  ];

  const recs: MockTenant[] = [];
  const memberStates: MockTenant[] = [];

  for (let i = 0; i < recCount && i < recData.length; i++) {
    const rd = recData[i];
    const rec = createMockTenant({
      name: rd.name,
      code: rd.code,
      level: TenantLevel.REC,
      parentId: continental.id,
      countryCode: null,
      recCode: rd.code,
      domain: `${rd.code.toLowerCase()}.aris.africa`,
    });
    recs.push(rec);

    for (let j = 0; j < msPerRec && j < rd.countries.length; j++) {
      const cc = rd.countries[j];
      const ms = createMockTenant({
        code: cc,
        name: `Republic of ${cc}`,
        level: TenantLevel.MEMBER_STATE,
        parentId: rec.id,
        countryCode: cc,
        recCode: rd.code,
        domain: `${cc.toLowerCase()}.aris.africa`,
      });
      memberStates.push(ms);
    }
  }

  return { continental, recs, memberStates };
}

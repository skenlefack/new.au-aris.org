import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConsistencyService } from './consistency.service';
import { TenantLevel } from '@aris/shared-types';

const UG = '00000000-0000-4000-a000-000000000103';
const SUB = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const AGENT = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const STEWARD = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const schema = {
  sections: [{ fields: [
    { code: 'goats_count', type: 'number', required: true, validation: { min: 0 } },
    { code: 'animals_died', type: 'number', validation: { min: 0 } },
    { code: 'first_case_date', type: 'date' },
  ] }],
};

function makePrisma(sub: Record<string, unknown>) {
  const state = { sub: { ...sub } as any };
  const prisma: any = {
    submission: {
      findUnique: vi.fn(async () => ({ ...state.sub })),
      findMany: vi.fn(async () => []),
      updateMany: vi.fn(async ({ where, data }: any) => {
        if (where.version !== state.sub.version) return { count: 0 };
        if (data.data) state.sub.data = data.data;
        if (data.status) state.sub.status = data.status;
        if (data.version?.increment) state.sub.version += data.version.increment;
        return { count: 1 };
      }),
    },
    formTemplate: { findUnique: vi.fn(async () => ({ schema })) },
    collectionCampaign: { findUnique: vi.fn(async () => ({ name: { en: 'Disease Mapping' } })) },
    auditLog: { create: vi.fn(async () => ({})) },
    $queryRawUnsafe: vi.fn(async () => []),
    $executeRawUnsafe: vi.fn(async () => 1),
  };
  return { prisma, state };
}

const baseSub = {
  id: SUB, tenantId: UG, campaignId: 'camp', templateId: 'tpl', submittedBy: AGENT, status: 'SUBMITTED', version: 1,
  submittedAt: new Date('2026-10-05T10:00:00Z'), dataClassification: 'RESTRICTED', gpsLat: null, gpsLng: null,
  data: { goats_count: 15, animals_died: 20, first_case_date: '2026-10-16' },
};
const steward: any = { userId: STEWARD, role: 'DATA_STEWARD', tenantId: UG, tenantLevel: TenantLevel.MEMBER_STATE, email: 's@x' };
const agent: any = { userId: AGENT, role: 'FIELD_AGENT', tenantId: UG, tenantLevel: TenantLevel.MEMBER_STATE, email: 'a@x' };

describe('ConsistencyService', () => {
  let ctx: ReturnType<typeof makePrisma>;
  let svc: ConsistencyService;
  beforeEach(() => {
    ctx = makePrisma(baseSub);
    svc = new ConsistencyService(ctx.prisma);
  });

  it('returns issues with field metadata', async () => {
    const r: any = (await svc.check(SUB, steward)).data;
    const codes = r.issues.map((i: any) => i.code);
    expect(codes).toEqual(expect.arrayContaining(['DEATHS_EXCEED_POPULATION', 'DATE_AFTER_SUBMISSION']));
    expect(r.fields.first_case_date.type).toBe('date');
  });

  it('hides submissions of another country', async () => {
    const other = { ...steward, tenantId: 'ffffffff-ffff-4fff-8fff-ffffffffffff' };
    await expect(svc.check(SUB, other)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('lets a validator correct a field, bumps the version and audits old and new values', async () => {
    const r: any = await svc.correct(SUB, { first_case_date: '2026-10-01' }, 'Typo in the year', steward);
    expect(r.data.data.first_case_date).toBe('2026-10-01');
    expect(r.data.version).toBe(2);
    expect(r.data.status).toBe('SUBMITTED');
    const audit = ctx.prisma.auditLog.create.mock.calls[0][0].data;
    expect(audit).toMatchObject({ action: 'CORRECT', entityId: SUB, actorUserId: STEWARD, reason: 'Typo in the year' });
    expect(audit.previousVersion).toEqual({ first_case_date: '2026-10-16' });
    expect(audit.newVersion).toMatchObject({ first_case_date: '2026-10-01', version: 2 });
  });

  it('refuses corrections from collectors, unknown fields, empty reasons and stale versions', async () => {
    await expect(svc.correct(SUB, { goats_count: 30 }, 'x', agent)).rejects.toMatchObject({ statusCode: 403 });
    await expect(svc.correct(SUB, { hacked: 1 }, 'x', steward)).rejects.toMatchObject({ statusCode: 400 });
    await expect(svc.correct(SUB, { goats_count: 30 }, '  ', steward)).rejects.toMatchObject({ statusCode: 400 });
    ctx.prisma.submission.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(svc.correct(SUB, { goats_count: 30 }, 'fix', steward)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('sends the submission back with the points to fix and notifies the collector', async () => {
    const r: any = await svc.requestCorrection(SUB, 'Please check', [{ field: 'animals_died', code: 'DEATHS_EXCEED_POPULATION', message: '20 dead for 15 animals' }], steward);
    expect(r.data.status).toBe('RETURNED');
    const audit = ctx.prisma.auditLog.create.mock.calls[0][0].data;
    expect(audit.action).toBe('REQUEST_CORRECTION');
    expect(audit.newVersion.items[0].message).toBe('20 dead for 15 animals');
    const [sql, userId, subject, body] = ctx.prisma.$executeRawUnsafe.mock.calls[0];
    expect(sql).toContain('INSERT INTO public.notifications');
    expect(userId).toBe(AGENT);
    expect(subject).toContain('correction');
    expect(body).toContain('20 dead for 15 animals');
  });

  it('does not let a validator send back their own submission', async () => {
    const own = { ...steward, userId: AGENT };
    await expect(svc.requestCorrection(SUB, 'x', [], own)).rejects.toMatchObject({ statusCode: 400 });
  });
});

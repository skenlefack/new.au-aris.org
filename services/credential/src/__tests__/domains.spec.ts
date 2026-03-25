import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DomainService } from '../services/domain.service.js';
import { domainsHook } from '@aris/auth-middleware/fastify';
import { UserRole, TenantLevel } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

// ── Mock Prisma ──
function createMockPrisma() {
  return {
    domain: {
      findMany: vi.fn(),
    },
    userDomain: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
      upsert: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(async (fn: (tx: any) => Promise<void>) => {
      const tx = {
        userDomain: {
          deleteMany: vi.fn(),
          createMany: vi.fn(),
        },
      };
      await fn(tx);
    }),
  } as any;
}

// ── Mock Kafka ──
function createMockKafka() {
  return {
    send: vi.fn().mockResolvedValue(undefined),
  } as any;
}

// ── Fake domain data ──
const MOCK_DOMAINS = [
  { id: 'dom-1', code: 'governance', name: { en: 'Governance' }, icon: 'Scale', color: '#1B5E20', sortOrder: 1, isActive: true },
  { id: 'dom-2', code: 'animal-health', name: { en: 'Animal Health' }, icon: 'HeartPulse', color: '#C62828', sortOrder: 2, isActive: true },
  { id: 'dom-3', code: 'livestock-prod', name: { en: 'Livestock Production' }, icon: 'Wheat', color: '#E65100', sortOrder: 3, isActive: true },
  { id: 'dom-4', code: 'trade-sps', name: { en: 'Trade & SPS' }, icon: 'ArrowLeftRight', color: '#1565C0', sortOrder: 4, isActive: true },
  { id: 'dom-5', code: 'fisheries', name: { en: 'Fisheries' }, icon: 'Fish', color: '#0277BD', sortOrder: 5, isActive: true },
  { id: 'dom-6', code: 'wildlife', name: { en: 'Wildlife' }, icon: 'TreePine', color: '#2E7D32', sortOrder: 6, isActive: true },
  { id: 'dom-7', code: 'apiculture', name: { en: 'Apiculture' }, icon: 'Bug', color: '#F9A825', sortOrder: 7, isActive: true },
  { id: 'dom-8', code: 'climate-env', name: { en: 'Climate & Environment' }, icon: 'Cloud', color: '#00695C', sortOrder: 8, isActive: true },
  { id: 'dom-9', code: 'knowledge-hub', name: { en: 'Knowledge Hub' }, icon: 'BookOpen', color: '#4527A0', sortOrder: 9, isActive: true },
];

describe('DomainService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let kafka: ReturnType<typeof createMockKafka>;
  let service: DomainService;

  beforeEach(() => {
    prisma = createMockPrisma();
    kafka = createMockKafka();
    service = new DomainService(prisma, kafka);
  });

  it('listDomains returns 9 active domains ordered by sortOrder', async () => {
    prisma.domain.findMany.mockResolvedValue(MOCK_DOMAINS);

    const result = await service.listDomains();

    expect(result.data).toHaveLength(9);
    expect(result.data[0].code).toBe('governance');
    expect(result.data[8].code).toBe('knowledge-hub');
    expect(prisma.domain.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      }),
    );
  });

  it('getUserDomains returns domains assigned to a user', async () => {
    const mockUserDomains = [
      { domain: { id: 'dom-2', code: 'animal-health', name: { en: 'Animal Health' }, icon: 'HeartPulse', color: '#C62828' }, assignedAt: new Date() },
      { domain: { id: 'dom-5', code: 'fisheries', name: { en: 'Fisheries' }, icon: 'Fish', color: '#0277BD' }, assignedAt: new Date() },
    ];
    prisma.userDomain.findMany.mockResolvedValue(mockUserDomains);

    const result = await service.getUserDomains('user-123');

    expect(result.data).toHaveLength(2);
    expect(result.data[0].code).toBe('animal-health');
    expect(result.data[1].code).toBe('fisheries');
  });

  it('setUserDomains replaces domains and publishes Kafka event', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-123' });
    prisma.domain.findMany.mockResolvedValue([
      { id: 'dom-2', isActive: true },
      { id: 'dom-5', isActive: true },
    ]);
    // For getUserDomains call after set
    prisma.userDomain.findMany.mockResolvedValue([
      { domain: { id: 'dom-2', code: 'animal-health', name: { en: 'Animal Health' }, icon: 'HeartPulse', color: '#C62828' }, assignedAt: new Date() },
      { domain: { id: 'dom-5', code: 'fisheries', name: { en: 'Fisheries' }, icon: 'Fish', color: '#0277BD' }, assignedAt: new Date() },
    ]);

    const result = await service.setUserDomains('user-123', ['dom-2', 'dom-5'], 'admin-1', 'tenant-1');

    expect(result.data).toHaveLength(2);
    expect(kafka.send).toHaveBeenCalledWith(
      'sys.credential.user.domains-updated.v1',
      'user-123',
      expect.objectContaining({ userId: 'user-123', domainIds: ['dom-2', 'dom-5'] }),
      expect.any(Object),
    );
  });

  it('setUserDomains throws 404 for non-existent user', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.setUserDomains('no-user', ['dom-1'], 'admin', 'tenant'),
    ).rejects.toThrow('User no-user not found');
  });

  it('setUserDomains throws 400 for invalid domain IDs', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-123' });
    prisma.domain.findMany.mockResolvedValue([{ id: 'dom-2', isActive: true }]); // only 1 of 2 found

    await expect(
      service.setUserDomains('user-123', ['dom-2', 'invalid-id'], 'admin', 'tenant'),
    ).rejects.toThrow('One or more domain IDs are invalid or inactive');
  });

  it('getUserDomainCodes returns array of code strings', async () => {
    prisma.userDomain.findMany.mockResolvedValue([
      { domain: { code: 'animal-health' } },
      { domain: { code: 'fisheries' } },
    ]);

    const codes = await service.getUserDomainCodes('user-123');

    expect(codes).toEqual(['animal-health', 'fisheries']);
  });
});

describe('domainsHook', () => {
  function createMockRequest(user: Partial<AuthenticatedUser>) {
    return { user } as any;
  }

  function createMockReply() {
    const reply: any = {
      code: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
    return reply;
  }

  it('blocks user without required domain', async () => {
    const hook = domainsHook('animal-health');
    const request = createMockRequest({
      userId: 'user-1',
      role: UserRole.NATIONAL_ADMIN,
      domains: ['fisheries', 'wildlife'],
    });
    const reply = createMockReply();

    await hook(request, reply);

    expect(reply.code).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
        message: expect.stringContaining('animal-health'),
      }),
    );
  });

  it('allows user with matching domain', async () => {
    const hook = domainsHook('animal-health', 'fisheries');
    const request = createMockRequest({
      userId: 'user-1',
      role: UserRole.DATA_STEWARD,
      domains: ['fisheries'],
    });
    const reply = createMockReply();

    const result = await hook(request, reply);

    expect(reply.code).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it('SUPER_ADMIN bypasses domain check', async () => {
    const hook = domainsHook('animal-health');
    const request = createMockRequest({
      userId: 'super-admin',
      role: UserRole.SUPER_ADMIN,
      domains: [], // no domains assigned, still passes
    });
    const reply = createMockReply();

    const result = await hook(request, reply);

    expect(reply.code).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it('returns 403 if no user authenticated', async () => {
    const hook = domainsHook('animal-health');
    const request = { user: undefined } as any;
    const reply = createMockReply();

    await hook(request, reply);

    expect(reply.code).toHaveBeenCalledWith(403);
  });
});

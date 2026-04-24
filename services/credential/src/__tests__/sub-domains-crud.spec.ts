import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubDomainService } from '../services/subdomain.service.js';

function createMockPrisma() {
  return {
    domain: { findUnique: vi.fn() },
    subDomain: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    valueChainCode: { findUnique: vi.fn() },
  } as any;
}

function createMockKafka() {
  return { send: vi.fn().mockResolvedValue(undefined) } as any;
}

describe('SubDomainService — CRUD', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let kafka: ReturnType<typeof createMockKafka>;
  let service: SubDomainService;

  const DOMAIN = { id: 'domain-uuid-1', code: 'livestock-prod', isActive: true };

  beforeEach(() => {
    prisma = createMockPrisma();
    kafka = createMockKafka();
    service = new SubDomainService(prisma, kafka);
  });

  // ─── CREATE ──────────────────────────────────────────────

  describe('create', () => {
    it('should create a sub-domain with valid valueChainCode', async () => {
      prisma.domain.findUnique.mockResolvedValue(DOMAIN);
      prisma.subDomain.findUnique.mockResolvedValue(null); // no duplicate
      prisma.valueChainCode.findUnique.mockResolvedValue({ code: 'DAIRY' });
      prisma.subDomain.create.mockResolvedValue({
        id: 'sd-1', code: 'DAIRY', domainId: DOMAIN.id, valueChainCode: 'DAIRY',
        labelFr: 'Lait', labelEn: 'Dairy', typeEnum: 'VALUE_CHAIN', active: true,
        domain: { code: 'livestock-prod' },
      });

      const result = await service.create({
        code: 'DAIRY', domainCode: 'livestock-prod', valueChainCode: 'DAIRY',
        labelFr: 'Lait', labelEn: 'Dairy', typeEnum: 'VALUE_CHAIN',
      }, 'actor-1');

      expect(result.data.code).toBe('DAIRY');
      expect(prisma.subDomain.create).toHaveBeenCalledOnce();
      expect(kafka.send).toHaveBeenCalledWith(
        'sys.credential.subdomain.created.v1',
        'sd-1',
        expect.objectContaining({ code: 'DAIRY', domainCode: 'livestock-prod' }),
        expect.any(Object),
      );
    });

    it('should return 400 for duplicate code in same domain', async () => {
      prisma.domain.findUnique.mockResolvedValue(DOMAIN);
      prisma.subDomain.findUnique.mockResolvedValue({ id: 'existing' }); // duplicate

      await expect(service.create({
        code: 'DAIRY', domainCode: 'livestock-prod',
        labelFr: 'Lait', labelEn: 'Dairy', typeEnum: 'VALUE_CHAIN',
      }, 'actor-1')).rejects.toThrow(/already exists/);
    });

    it('should return 404 for non-existent domain', async () => {
      prisma.domain.findUnique.mockResolvedValue(null);

      await expect(service.create({
        code: 'X', domainCode: 'nonexistent',
        labelFr: 'X', labelEn: 'X', typeEnum: 'OTHER',
      }, 'actor-1')).rejects.toThrow(/not found/);
    });

    it('should return 422 for non-existent valueChainCode', async () => {
      prisma.domain.findUnique.mockResolvedValue(DOMAIN);
      prisma.subDomain.findUnique.mockResolvedValue(null);
      prisma.valueChainCode.findUnique.mockResolvedValue(null);

      await expect(service.create({
        code: 'X', domainCode: 'livestock-prod', valueChainCode: 'INVALID',
        labelFr: 'X', labelEn: 'X', typeEnum: 'VALUE_CHAIN',
      }, 'actor-1')).rejects.toThrow(/does not exist/);
    });
  });

  // ─── UPDATE ──────────────────────────────────────────────

  describe('update', () => {
    it('should emit activated event when active changes to true', async () => {
      prisma.subDomain.findUnique.mockResolvedValue({
        id: 'sd-1', code: 'DAIRY', active: false, domain: { code: 'livestock-prod' },
      });
      prisma.subDomain.update.mockResolvedValue({
        id: 'sd-1', code: 'DAIRY', active: true, domain: { code: 'livestock-prod' },
      });

      await service.update('sd-1', { active: true }, 'actor-1');

      expect(kafka.send).toHaveBeenCalledWith(
        'sys.credential.subdomain.activated.v1',
        'sd-1',
        expect.objectContaining({ active: true }),
        expect.any(Object),
      );
    });

    it('should emit deactivated event when active changes to false', async () => {
      prisma.subDomain.findUnique.mockResolvedValue({
        id: 'sd-1', code: 'DAIRY', active: true, domain: { code: 'livestock-prod' },
      });
      prisma.subDomain.update.mockResolvedValue({
        id: 'sd-1', code: 'DAIRY', active: false, domain: { code: 'livestock-prod' },
      });

      await service.update('sd-1', { active: false }, 'actor-1');

      expect(kafka.send).toHaveBeenCalledWith(
        'sys.credential.subdomain.deactivated.v1',
        'sd-1',
        expect.objectContaining({ active: false }),
        expect.any(Object),
      );
    });

    it('should emit updated event for non-active changes', async () => {
      prisma.subDomain.findUnique.mockResolvedValue({
        id: 'sd-1', code: 'DAIRY', active: true, domain: { code: 'livestock-prod' },
      });
      prisma.subDomain.update.mockResolvedValue({
        id: 'sd-1', code: 'DAIRY', active: true, labelFr: 'Laitier', domain: { code: 'livestock-prod' },
      });

      await service.update('sd-1', { labelFr: 'Laitier' }, 'actor-1');

      expect(kafka.send).toHaveBeenCalledWith(
        'sys.credential.subdomain.updated.v1',
        'sd-1',
        expect.objectContaining({ changes: { labelFr: 'Laitier' } }),
        expect.any(Object),
      );
    });
  });

  // ─── DELETE ──────────────────────────────────────────────

  describe('delete', () => {
    it('should delete and emit event', async () => {
      prisma.subDomain.findUnique.mockResolvedValue({
        id: 'sd-1', code: 'DAIRY', domain: { code: 'livestock-prod' },
      });
      prisma.subDomain.delete.mockResolvedValue({});

      const result = await service.delete('sd-1', 'actor-1');

      expect(result.data.deleted).toBe(true);
      expect(kafka.send).toHaveBeenCalledWith(
        'sys.credential.subdomain.deleted.v1',
        'sd-1',
        expect.objectContaining({ code: 'DAIRY' }),
        expect.any(Object),
      );
    });

    it('should return 404 for non-existent sub-domain', async () => {
      prisma.subDomain.findUnique.mockResolvedValue(null);
      await expect(service.delete('nonexistent', 'actor-1')).rejects.toThrow(/not found/);
    });
  });
});

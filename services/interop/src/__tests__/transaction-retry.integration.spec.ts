import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TransactionService } from '../services/transaction.service.js';

function createMockPrisma() {
  const transactions: Record<string, any> = {
    'tx-001': {
      id: 'tx-001',
      connection_id: 'conn-001',
      direction: 'OUTBOUND',
      entity_type: 'outbreak',
      source_payload: { test: true },
      status: 'FAILED',
      error_message: 'HTTP 503',
      retry_count: 1,
      max_retries: 3,
      tenant_id: 'tenant-001',
      created_at: new Date(),
    },
    'tx-002': {
      id: 'tx-002',
      connection_id: 'conn-001',
      direction: 'OUTBOUND',
      entity_type: 'outbreak',
      source_payload: { test: true },
      status: 'FAILED',
      error_message: 'HTTP 500',
      retry_count: 3,
      max_retries: 3,
      tenant_id: 'tenant-001',
      created_at: new Date(),
    },
  };

  return {
    interopTransaction: {
      findUnique: vi.fn().mockImplementation(({ where }: { where: { id: string } }) => {
        return Promise.resolve(transactions[where.id] ?? null);
      }),
      update: vi.fn().mockImplementation(({ where, data }: { where: { id: string }; data: any }) => {
        const tx = transactions[where.id];
        if (!tx) return Promise.resolve(null);
        Object.assign(tx, data);
        return Promise.resolve(tx);
      }),
      create: vi.fn().mockResolvedValue({ id: 'tx-new' }),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
  };
}

describe('TransactionService — Retry', () => {
  let service: TransactionService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  const mockUser = {
    userId: 'user-001',
    email: 'admin@ke.au-aris.org',
    role: 'NATIONAL_ADMIN' as const,
    tenantId: 'tenant-001',
    tenantLevel: 'MEMBER_STATE' as const,
    locale: 'en',
  };

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    service = new TransactionService(mockPrisma as any);
  });

  it('should retry a failed transaction and update retry count', async () => {
    const result = await service.retry('tx-001', mockUser);

    expect(result.data.status).toBe('PENDING');
    expect(result.data.retry_count).toBe(2);
    expect(result.data.error_message).toBeNull();

    expect(mockPrisma.interopTransaction.update).toHaveBeenCalledWith({
      where: { id: 'tx-001' },
      data: {
        status: 'PENDING',
        retry_count: 2,
        error_message: null,
      },
    });
  });

  it('should reject retry when max retries exceeded', async () => {
    await expect(service.retry('tx-002', mockUser)).rejects.toThrow('Max retries (3) exceeded');
  });
});

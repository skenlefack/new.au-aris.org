import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerOutboundPipelines } from '../hub/outbound-trigger';

const TENANT = '00000000-0000-0000-0000-000000000010';

describe('triggerOutboundPipelines', () => {
  let prisma: { hubPipeline: { findMany: ReturnType<typeof vi.fn> } };
  let engine: { executePipeline: ReturnType<typeof vi.fn> };
  let logger: { info: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; debug: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    prisma = {
      hubPipeline: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'p1', created_by: 'u1' },
          { id: 'p2', created_by: 'u2' },
        ]),
      },
    };
    engine = { executePipeline: vi.fn().mockResolvedValue({ id: 'tx' }) };
    logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  });

  const run = (data: Record<string, unknown>, filter?: Record<string, unknown>) =>
    triggerOutboundPipelines(prisma, engine as any, logger as any, TENANT, data, filter);

  it('looks up only active automatic outbound pipelines of the tenant', async () => {
    await run({ id: 'wf-1' }, { connection: { system_type: 'WAHIS' } });

    expect(prisma.hubPipeline.findMany).toHaveBeenCalledWith({
      where: {
        connection: { system_type: 'WAHIS' },
        tenant_id: TENANT,
        direction: 'OUTBOUND',
        status: 'ACTIVE',
        mode: 'AUTOMATIC',
      },
    });
  });

  it('cannot be tricked into another tenant through the filter', async () => {
    await run({}, { tenant_id: 'other-tenant', status: 'DRAFT' });

    const where = prisma.hubPipeline.findMany.mock.calls[0][0].where;
    expect(where.tenant_id).toBe(TENANT);
    expect(where.status).toBe('ACTIVE');
  });

  it('wraps a single event as one record', async () => {
    const data = { id: 'wf-1', domain: 'health' };
    await run(data);

    expect(engine.executePipeline).toHaveBeenCalledWith('p1', { records: [data] }, 'u1');
    expect(engine.executePipeline).toHaveBeenCalledWith('p2', { records: [data] }, 'u2');
  });

  it('passes an event records array through as-is', async () => {
    const records = [{ a: 1 }, { a: 2 }];
    await run({ records });

    expect(engine.executePipeline).toHaveBeenCalledWith('p1', { records }, 'u1');
  });

  it('keeps going when one pipeline fails', async () => {
    engine.executePipeline.mockRejectedValueOnce(new Error('no steps'));

    const result = await run({ id: 'x' });

    expect(result).toEqual({ executed: ['p2'], failed: ['p1'] });
    expect(logger.error).toHaveBeenCalledOnce();
  });

  it('never throws when the pipeline lookup fails', async () => {
    prisma.hubPipeline.findMany.mockRejectedValue(new Error('db down'));

    await expect(run({ id: 'x' })).resolves.toEqual({ executed: [], failed: [] });
    expect(engine.executePipeline).not.toHaveBeenCalled();
  });

  it('does nothing when no pipeline matches', async () => {
    prisma.hubPipeline.findMany.mockResolvedValue([]);

    await expect(run({ id: 'x' })).resolves.toEqual({ executed: [], failed: [] });
    expect(engine.executePipeline).not.toHaveBeenCalled();
  });
});

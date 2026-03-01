import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupportService } from '../support.service';

// ── Mocks ──
function createMockPrisma() {
  return {
    ticket: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    ticketComment: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    ticketSLA: {
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  };
}

function createMockRedis() {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    keys: vi.fn().mockResolvedValue([]),
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
  };
}

function createMockKafka() {
  return {
    send: vi.fn().mockResolvedValue(undefined),
  };
}

const TENANT_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = '22222222-2222-2222-2222-222222222222';

describe('SupportService', () => {
  let service: SupportService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let redis: ReturnType<typeof createMockRedis>;
  let kafka: ReturnType<typeof createMockKafka>;

  beforeEach(() => {
    prisma = createMockPrisma();
    redis = createMockRedis();
    kafka = createMockKafka();
    service = new SupportService(prisma as any, redis as any, kafka as any);
  });

  // ── 1. Create ticket with auto-reference ──
  it('should create a ticket with auto-generated SUP-YYYY-NNNNN reference', async () => {
    const year = new Date().getFullYear();
    const ticketData = {
      id: expect.any(String),
      reference: `SUP-${year}-00001`,
      tenant_id: TENANT_ID,
      title: 'Test ticket',
      description: 'Test description',
      category: 'TECHNICAL',
      priority: 'HIGH',
      status: 'OPEN',
    };
    prisma.ticket.create.mockResolvedValue(ticketData);

    const result = await service.createTicket(
      { title: 'Test ticket', description: 'Test description', category: 'TECHNICAL', priority: 'HIGH' },
      TENANT_ID,
      USER_ID,
    );

    expect(result.data).toBeDefined();
    expect(prisma.ticket.create).toHaveBeenCalledTimes(1);
    // Check SLA was created (via include in create)
    const createCall = prisma.ticket.create.mock.calls[0][0];
    expect(createCall.data.sla).toBeDefined();
    expect(createCall.data.sla.create).toBeDefined();
  });

  // ── 2. Auto-reference sequence increments ──
  it('should increment reference sequence on each ticket', async () => {
    redis.incr.mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    prisma.ticket.create.mockResolvedValue({ id: 'uuid', reference: 'SUP-2026-00001' });

    await service.createTicket(
      { title: 'First', description: 'Desc', category: 'GENERAL', priority: 'LOW' },
      TENANT_ID, USER_ID,
    );
    await service.createTicket(
      { title: 'Second', description: 'Desc', category: 'GENERAL', priority: 'LOW' },
      TENANT_ID, USER_ID,
    );

    expect(redis.incr).toHaveBeenCalledTimes(2);
  });

  // ── 3. SLA deadline calculated from priority matrix ──
  it('should calculate SLA deadline based on category + priority', async () => {
    prisma.ticket.create.mockImplementation((args: any) => Promise.resolve(args.data));

    await service.createTicket(
      { title: 'Critical tech', description: 'Urgent', category: 'TECHNICAL', priority: 'CRITICAL' },
      TENANT_ID, USER_ID,
    );

    const createCall = prisma.ticket.create.mock.calls[0][0];
    const deadline = new Date(createCall.data.sla_deadline);
    const now = Date.now();
    // TECHNICAL + CRITICAL = 4h resolution
    const diffHours = (deadline.getTime() - now) / 3600_000;
    expect(diffHours).toBeGreaterThan(3);
    expect(diffHours).toBeLessThan(5);
  });

  // ── 4. List tickets with pagination ──
  it('should list tickets with pagination and cache', async () => {
    const tickets = [{ id: '1', title: 'T1' }, { id: '2', title: 'T2' }];
    prisma.ticket.findMany.mockResolvedValue(tickets);
    prisma.ticket.count.mockResolvedValue(2);

    const result = await service.listTickets(TENANT_ID, { page: 1, limit: 10 });

    expect(result.data).toHaveLength(2);
    expect(result.meta.total).toBe(2);
    expect(result.meta.page).toBe(1);
    expect(redis.set).toHaveBeenCalled();
  });

  // ── 5. List tickets returns cached data ──
  it('should return cached list data when available', async () => {
    const cached = { data: [{ id: '1' }], meta: { total: 1, page: 1, limit: 20 } };
    redis.get.mockResolvedValue(JSON.stringify(cached));

    const result = await service.listTickets(TENANT_ID, {});

    expect(result).toEqual(cached);
    expect(prisma.ticket.findMany).not.toHaveBeenCalled();
  });

  // ── 6. Get ticket by ID ──
  it('should get ticket by ID with comments and SLA', async () => {
    const ticket = { id: 'uuid', title: 'Test', comments: [], sla: {} };
    prisma.ticket.findFirst.mockResolvedValue(ticket);

    const result = await service.getTicket('uuid', TENANT_ID);

    expect(result.data).toEqual(ticket);
    expect(prisma.ticket.findFirst).toHaveBeenCalledWith({
      where: { id: 'uuid', tenant_id: TENANT_ID, deleted_at: null },
      include: { comments: true, sla: true },
    });
  });

  // ── 7. Get ticket 404 ──
  it('should throw 404 when ticket not found', async () => {
    prisma.ticket.findFirst.mockResolvedValue(null);

    await expect(service.getTicket('nonexistent', TENANT_ID)).rejects.toThrow('Support ticket not found');
  });

  // ── 8. Update ticket status + assignment ──
  it('should update ticket and publish assignment event when assignedTo changes', async () => {
    prisma.ticket.findFirst.mockResolvedValue({ id: 'uuid', assigned_to: null });
    prisma.ticket.update.mockResolvedValue({ id: 'uuid', assigned_to: 'new-user' });

    await service.updateTicket('uuid', { assignedTo: 'new-user' }, TENANT_ID, USER_ID);

    expect(prisma.ticket.update).toHaveBeenCalledTimes(1);
    // Should publish both ASSIGNED and UPDATED events
    expect(kafka.send).toHaveBeenCalledTimes(2);
  });

  // ── 9. Close ticket publishes CLOSED event ──
  it('should publish CLOSED event when status set to CLOSED', async () => {
    prisma.ticket.findFirst.mockResolvedValue({ id: 'uuid', assigned_to: null });
    prisma.ticket.update.mockResolvedValue({ id: 'uuid', status: 'CLOSED' });

    await service.updateTicket('uuid', { status: 'CLOSED' }, TENANT_ID, USER_ID);

    // Should publish UPDATED + CLOSED events
    const topics = kafka.send.mock.calls.map((c: any[]) => c[0]);
    expect(topics).toContain('sys.support.ticket.updated.v1');
    expect(topics).toContain('sys.support.ticket.closed.v1');
  });

  // ── 10. Escalate ticket ──
  it('should escalate ticket to higher-level tenant', async () => {
    const targetTenant = '33333333-3333-3333-3333-333333333333';
    prisma.ticket.findFirst.mockResolvedValue({ id: 'uuid', status: 'OPEN' });
    prisma.ticket.update.mockResolvedValue({ id: 'uuid', status: 'ESCALATED', escalated_to: targetTenant });
    prisma.ticketComment.create.mockResolvedValue({ id: 'comment-uuid' });

    const result = await service.escalateTicket(
      'uuid',
      { targetTenantId: targetTenant, reason: 'Need REC help' },
      TENANT_ID, USER_ID,
    );

    expect(result.data.status).toBe('ESCALATED');
    expect(prisma.ticketComment.create).toHaveBeenCalledTimes(1);
    expect(kafka.send).toHaveBeenCalled();
  });

  // ── 11. Cannot escalate closed ticket ──
  it('should reject escalation of closed ticket', async () => {
    prisma.ticket.findFirst.mockResolvedValue({ id: 'uuid', status: 'CLOSED' });

    await expect(
      service.escalateTicket('uuid', { targetTenantId: 'other' }, TENANT_ID, USER_ID),
    ).rejects.toThrow('Cannot escalate a resolved or closed ticket');
  });

  // ── 12. Add comment ──
  it('should add comment and mark SLA response', async () => {
    prisma.ticket.findFirst.mockResolvedValue({ id: 'uuid' });
    prisma.ticketComment.create.mockResolvedValue({ id: 'comment-uuid', content: 'Reply' });
    prisma.ticketSLA.findFirst.mockResolvedValue({ id: 'sla-uuid', responded_at: null });

    const result = await service.addComment('uuid', { content: 'Reply' }, TENANT_ID, USER_ID);

    expect(result.data.content).toBe('Reply');
    expect(prisma.ticketSLA.update).toHaveBeenCalledTimes(1);
  });

  // ── 13. SLA breach check ──
  it('should detect and mark SLA breaches', async () => {
    const breachedTickets = [
      { id: 'b1', tenant_id: TENANT_ID, sla_deadline: new Date(Date.now() - 3600_000) },
      { id: 'b2', tenant_id: TENANT_ID, sla_deadline: new Date(Date.now() - 7200_000) },
    ];
    prisma.ticket.findMany.mockResolvedValue(breachedTickets);
    prisma.ticket.update.mockResolvedValue({});
    prisma.ticketSLA.updateMany.mockResolvedValue({ count: 1 });

    const count = await service.checkSlaBreaches();

    expect(count).toBe(2);
    expect(prisma.ticket.update).toHaveBeenCalledTimes(2);
    expect(kafka.send).toHaveBeenCalledTimes(2);
  });

  // ── 14. SLA stats ──
  it('should return SLA compliance stats', async () => {
    prisma.ticket.count
      .mockResolvedValueOnce(100)  // total
      .mockResolvedValueOnce(5)    // breached
      .mockResolvedValueOnce(80);  // resolved
    prisma.ticket.findMany.mockResolvedValue([]); // for avg resolution time

    const result = await service.getSlaStats(TENANT_ID, { period: '30d' });

    expect(result.data.total).toBe(100);
    expect(result.data.breached).toBe(5);
    expect(result.data.slaComplianceRate).toBe('95.0');
  });

  // ── 15. Kafka event published on create ──
  it('should publish Kafka event on ticket creation', async () => {
    prisma.ticket.create.mockResolvedValue({ id: 'uuid', reference: 'SUP-2026-00001' });

    await service.createTicket(
      { title: 'Test', description: 'Desc', category: 'GENERAL', priority: 'LOW' },
      TENANT_ID, USER_ID,
    );

    expect(kafka.send).toHaveBeenCalledTimes(1);
    expect(kafka.send.mock.calls[0][0]).toBe('sys.support.ticket.created.v1');
  });

  // ── 16. List comments ──
  it('should list comments for a ticket', async () => {
    prisma.ticket.findFirst.mockResolvedValue({ id: 'uuid' });
    prisma.ticketComment.findMany.mockResolvedValue([
      { id: 'c1', content: 'First' },
      { id: 'c2', content: 'Second' },
    ]);

    const result = await service.listComments('uuid', TENANT_ID);

    expect(result.data).toHaveLength(2);
  });

  // ── 17. Cache invalidation on update ──
  it('should invalidate caches on ticket update', async () => {
    prisma.ticket.findFirst.mockResolvedValue({ id: 'uuid', assigned_to: null });
    prisma.ticket.update.mockResolvedValue({ id: 'uuid' });

    await service.updateTicket('uuid', { priority: 'HIGH' }, TENANT_ID, USER_ID);

    expect(redis.del).toHaveBeenCalledWith('aris:support:ticket:uuid');
    expect(redis.keys).toHaveBeenCalled();
  });
});

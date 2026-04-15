import { TenantService } from './tenant.service.js';

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function makePrisma() {
  return {
    tenant: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
  };
}

function makeKafka() {
  return { send: vi.fn() };
}

const superAdmin = {
  userId: 'u-1',
  email: 'admin@au-aris.org',
  role: 'SUPER_ADMIN',
  tenantId: 't-au',
  tenantLevel: 'CONTINENTAL',
};

const recAdmin = {
  userId: 'u-2',
  email: 'rec@igad.au-aris.org',
  role: 'REC_ADMIN',
  tenantId: 't-igad',
  tenantLevel: 'REC',
};

const nationalAdmin = {
  userId: 'u-3',
  email: 'admin@ke.au-aris.org',
  role: 'NATIONAL_ADMIN',
  tenantId: 't-ke',
  tenantLevel: 'MEMBER_STATE',
};

function makeTenant(overrides: Record<string, unknown> = {}) {
  return {
    id: 't-new',
    name: 'Test Tenant',
    code: 'TEST',
    level: 'MEMBER_STATE',
    parentId: 't-igad',
    countryCode: 'KE',
    recCode: null,
    domain: 'test.au-aris.org',
    config: {},
    isActive: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

describe('TenantService', () => {
  let service: TenantService;
  let prisma: ReturnType<typeof makePrisma>;
  let kafka: ReturnType<typeof makeKafka>;

  beforeEach(() => {
    prisma = makePrisma();
    kafka = makeKafka();
    service = new TenantService(prisma as any, kafka as any);
  });

  /* ---- create --------------------------------------------------- */

  describe('create', () => {
    const dto = {
      name: 'Kenya',
      code: 'KE',
      level: 'MEMBER_STATE',
      parentId: 't-igad',
      countryCode: 'KE',
      domain: 'ke.au-aris.org',
    };

    it('creates tenant with valid data and publishes Kafka event', async () => {
      const created = makeTenant({ id: 't-ke', name: 'Kenya', code: 'KE' });
      prisma.tenant.findUnique
        .mockResolvedValueOnce(null)        // code uniqueness check
        .mockResolvedValueOnce({ id: 't-igad' }); // parent exists check
      prisma.tenant.create.mockResolvedValue(created);
      kafka.send.mockResolvedValue(undefined);

      const result = await service.create(dto, superAdmin);

      expect(result.data).toEqual(created);
      expect(prisma.tenant.findUnique).toHaveBeenCalledWith({ where: { code: 'KE' } });
      expect(prisma.tenant.findUnique).toHaveBeenCalledWith({ where: { id: 't-igad' } });
      expect(prisma.tenant.create).toHaveBeenCalledTimes(1);
      expect(prisma.tenant.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Kenya',
          code: 'KE',
          level: 'MEMBER_STATE',
          parentId: 't-igad',
          countryCode: 'KE',
          domain: 'ke.au-aris.org',
          isActive: true,
        }),
      });
      expect(kafka.send).toHaveBeenCalledWith(
        'sys.tenant.created.v1',
        created.id,
        created,
        expect.objectContaining({
          sourceService: 'tenant-service',
          tenantId: superAdmin.tenantId,
          userId: superAdmin.userId,
          schemaVersion: '1',
        }),
      );
    });

    it('throws 409 if code already exists', async () => {
      prisma.tenant.findUnique.mockResolvedValueOnce(makeTenant({ code: 'KE' }));

      await expect(service.create(dto, superAdmin)).rejects.toThrow('already exists');
      await expect(service.create(dto, superAdmin)).rejects.toMatchObject({ statusCode: 409 });
      expect(prisma.tenant.create).not.toHaveBeenCalled();
    });

    it('throws 404 if parent tenant not found', async () => {
      prisma.tenant.findUnique
        .mockResolvedValueOnce(null)   // code check passes
        .mockResolvedValueOnce(null);  // parent not found

      await expect(service.create(dto, superAdmin)).rejects.toThrow('not found');
      await expect(service.create(dto, superAdmin)).rejects.toMatchObject({ statusCode: 404 });
      expect(prisma.tenant.create).not.toHaveBeenCalled();
    });

    it('creates tenant without parentId (top-level)', async () => {
      const topDto = { name: 'AU-IBAR', code: 'AU', level: 'CONTINENTAL', domain: 'au-aris.org' };
      const created = makeTenant({ id: 't-au', name: 'AU-IBAR', code: 'AU', parentId: null });
      prisma.tenant.findUnique.mockResolvedValueOnce(null); // code check
      prisma.tenant.create.mockResolvedValue(created);
      kafka.send.mockResolvedValue(undefined);

      const result = await service.create(topDto, superAdmin);

      expect(result.data).toEqual(created);
      // Should NOT call findUnique a second time for parent lookup
      expect(prisma.tenant.findUnique).toHaveBeenCalledTimes(1);
      expect(prisma.tenant.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ parentId: null }),
      });
    });
  });

  /* ---- findAll -------------------------------------------------- */

  describe('findAll', () => {
    it('continental user sees all tenants (empty filter)', async () => {
      const tenants = [makeTenant({ id: 't-1' }), makeTenant({ id: 't-2' })];
      prisma.tenant.findMany.mockResolvedValue(tenants);
      prisma.tenant.count.mockResolvedValue(2);

      const result = await service.findAll(superAdmin, {});

      expect(prisma.tenant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
      expect(result.data).toHaveLength(2);
      expect(result.meta).toEqual({ total: 2, page: 1, limit: 20 });
    });

    it('REC user only sees own tenant + children', async () => {
      const tenants = [makeTenant({ id: 't-igad' })];
      prisma.tenant.findMany.mockResolvedValue(tenants);
      prisma.tenant.count.mockResolvedValue(1);

      const result = await service.findAll(recAdmin, {});

      expect(prisma.tenant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { OR: [{ id: 't-igad' }, { parentId: 't-igad' }] },
        }),
      );
      expect(result.data).toHaveLength(1);
    });

    it('member state user only sees own tenant', async () => {
      const tenants = [makeTenant({ id: 't-ke' })];
      prisma.tenant.findMany.mockResolvedValue(tenants);
      prisma.tenant.count.mockResolvedValue(1);

      const result = await service.findAll(nationalAdmin, {});

      expect(prisma.tenant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 't-ke' },
        }),
      );
      expect(result.data).toHaveLength(1);
    });

    it('respects pagination (page, limit)', async () => {
      prisma.tenant.findMany.mockResolvedValue([makeTenant()]);
      prisma.tenant.count.mockResolvedValue(50);

      const result = await service.findAll(superAdmin, { page: 3, limit: 10 });

      expect(prisma.tenant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
      expect(result.meta).toEqual({ total: 50, page: 3, limit: 10 });
    });

    it('clamps limit to MAX_LIMIT (100)', async () => {
      prisma.tenant.findMany.mockResolvedValue([]);
      prisma.tenant.count.mockResolvedValue(0);

      await service.findAll(superAdmin, { page: 1, limit: 500 });

      expect(prisma.tenant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });

    it('applies sort and order', async () => {
      prisma.tenant.findMany.mockResolvedValue([]);
      prisma.tenant.count.mockResolvedValue(0);

      await service.findAll(superAdmin, { sort: 'name', order: 'desc' });

      expect(prisma.tenant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { name: 'desc' } }),
      );
    });
  });

  /* ---- findOne -------------------------------------------------- */

  describe('findOne', () => {
    it('returns tenant when user has access', async () => {
      const tenant = makeTenant({ id: 't-ke', parentId: 't-igad' });
      prisma.tenant.findUnique.mockResolvedValue(tenant);

      const result = await service.findOne('t-ke', recAdmin);

      expect(result.data).toEqual(tenant);
      expect(prisma.tenant.findUnique).toHaveBeenCalledWith({ where: { id: 't-ke' } });
    });

    it('throws 404 when tenant not found', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      await expect(service.findOne('t-nonexistent', superAdmin)).rejects.toThrow('not found');
      await expect(service.findOne('t-nonexistent', superAdmin)).rejects.toMatchObject({ statusCode: 404 });
    });

    it('throws 403/404 when user has no access', async () => {
      // National admin trying to access a tenant that is not theirs
      const otherTenant = makeTenant({ id: 't-et', parentId: 't-igad' });
      prisma.tenant.findUnique.mockResolvedValue(otherTenant);

      await expect(service.findOne('t-et', nationalAdmin)).rejects.toThrow('not found');
    });

    it('continental user can access any tenant', async () => {
      const tenant = makeTenant({ id: 't-random', parentId: 't-ecowas' });
      prisma.tenant.findUnique.mockResolvedValue(tenant);

      const result = await service.findOne('t-random', superAdmin);

      expect(result.data).toEqual(tenant);
    });

    it('REC user can access child tenant', async () => {
      const childTenant = makeTenant({ id: 't-ke', parentId: 't-igad' });
      prisma.tenant.findUnique.mockResolvedValue(childTenant);

      const result = await service.findOne('t-ke', recAdmin);

      expect(result.data).toEqual(childTenant);
    });

    it('REC user cannot access tenant outside its hierarchy', async () => {
      const otherTenant = makeTenant({ id: 't-ng', parentId: 't-ecowas' });
      prisma.tenant.findUnique.mockResolvedValue(otherTenant);

      await expect(service.findOne('t-ng', recAdmin)).rejects.toThrow('not found');
    });
  });

  /* ---- update --------------------------------------------------- */

  describe('update', () => {
    it('updates tenant fields and publishes event', async () => {
      const existing = makeTenant({ id: 't-ke' });
      const updated = { ...existing, name: 'Kenya Updated', domain: 'new.ke.au-aris.org' };
      prisma.tenant.findUnique.mockResolvedValue(existing);
      prisma.tenant.update.mockResolvedValue(updated);
      kafka.send.mockResolvedValue(undefined);

      const result = await service.update(
        't-ke',
        { name: 'Kenya Updated', domain: 'new.ke.au-aris.org' },
        superAdmin,
      );

      expect(result.data).toEqual(updated);
      expect(prisma.tenant.update).toHaveBeenCalledWith({
        where: { id: 't-ke' },
        data: { name: 'Kenya Updated', domain: 'new.ke.au-aris.org' },
      });
      expect(kafka.send).toHaveBeenCalledWith(
        'sys.tenant.updated.v1',
        updated.id,
        updated,
        expect.objectContaining({
          sourceService: 'tenant-service',
          tenantId: superAdmin.tenantId,
          userId: superAdmin.userId,
        }),
      );
    });

    it('throws 404 for non-existent tenant', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      await expect(
        service.update('t-nonexistent', { name: 'X' }, superAdmin),
      ).rejects.toThrow('not found');
      await expect(
        service.update('t-nonexistent', { name: 'X' }, superAdmin),
      ).rejects.toMatchObject({ statusCode: 404 });
      expect(prisma.tenant.update).not.toHaveBeenCalled();
    });

    it('updates only provided fields', async () => {
      const existing = makeTenant({ id: 't-ke' });
      prisma.tenant.findUnique.mockResolvedValue(existing);
      prisma.tenant.update.mockResolvedValue({ ...existing, isActive: false });
      kafka.send.mockResolvedValue(undefined);

      await service.update('t-ke', { isActive: false }, superAdmin);

      expect(prisma.tenant.update).toHaveBeenCalledWith({
        where: { id: 't-ke' },
        data: { isActive: false },
      });
    });

    it('updates config as JSON value', async () => {
      const existing = makeTenant({ id: 't-ke' });
      const newConfig = { theme: 'dark', lang: 'sw' };
      prisma.tenant.findUnique.mockResolvedValue(existing);
      prisma.tenant.update.mockResolvedValue({ ...existing, config: newConfig });
      kafka.send.mockResolvedValue(undefined);

      await service.update('t-ke', { config: newConfig }, superAdmin);

      expect(prisma.tenant.update).toHaveBeenCalledWith({
        where: { id: 't-ke' },
        data: { config: newConfig },
      });
    });
  });

  /* ---- findChildren --------------------------------------------- */

  describe('findChildren', () => {
    it('returns child tenants of given parent', async () => {
      const parent = makeTenant({ id: 't-igad', level: 'REC', parentId: 't-au' });
      const children = [
        makeTenant({ id: 't-ke', parentId: 't-igad' }),
        makeTenant({ id: 't-et', parentId: 't-igad' }),
      ];
      prisma.tenant.findUnique.mockResolvedValue(parent);
      prisma.tenant.findMany.mockResolvedValue(children);
      prisma.tenant.count.mockResolvedValue(2);

      const result = await service.findChildren('t-igad', superAdmin, {});

      expect(result.data).toHaveLength(2);
      expect(result.meta).toEqual({ total: 2, page: 1, limit: 20 });
      expect(prisma.tenant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { parentId: 't-igad' },
          orderBy: { name: 'asc' },
        }),
      );
    });

    it('returns empty result for leaf tenants', async () => {
      const leaf = makeTenant({ id: 't-ke', level: 'MEMBER_STATE', parentId: 't-igad' });
      prisma.tenant.findUnique.mockResolvedValue(leaf);
      prisma.tenant.findMany.mockResolvedValue([]);
      prisma.tenant.count.mockResolvedValue(0);

      const result = await service.findChildren('t-ke', superAdmin, {});

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });

    it('throws 404 if parent tenant not found', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      await expect(
        service.findChildren('t-nonexistent', superAdmin, {}),
      ).rejects.toThrow('not found');
    });

    it('verifies access before returning children', async () => {
      // National admin cannot see children of a REC they don't belong to
      const otherRec = makeTenant({ id: 't-ecowas', level: 'REC', parentId: 't-au' });
      prisma.tenant.findUnique.mockResolvedValue(otherRec);

      await expect(
        service.findChildren('t-ecowas', nationalAdmin, {}),
      ).rejects.toThrow('not found');
      expect(prisma.tenant.findMany).not.toHaveBeenCalled();
    });

    it('respects pagination for children', async () => {
      const parent = makeTenant({ id: 't-igad', level: 'REC', parentId: 't-au' });
      prisma.tenant.findUnique.mockResolvedValue(parent);
      prisma.tenant.findMany.mockResolvedValue([makeTenant()]);
      prisma.tenant.count.mockResolvedValue(15);

      const result = await service.findChildren('t-igad', superAdmin, { page: 2, limit: 5 });

      expect(prisma.tenant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 5, take: 5 }),
      );
      expect(result.meta).toEqual({ total: 15, page: 2, limit: 5 });
    });
  });

  /* ---- Kafka failure resilience --------------------------------- */

  describe('Kafka failure resilience', () => {
    it('create succeeds even if Kafka publish fails', async () => {
      const created = makeTenant({ id: 't-new' });
      prisma.tenant.findUnique.mockResolvedValueOnce(null); // code check
      prisma.tenant.create.mockResolvedValue(created);
      kafka.send.mockRejectedValue(new Error('Kafka down'));

      const result = await service.create(
        { name: 'New', code: 'NEW', level: 'MEMBER_STATE', domain: 'new.au-aris.org' },
        superAdmin,
      );

      // Should not throw despite Kafka failure (try/catch in publishEvent)
      expect(result.data).toEqual(created);
    });

    it('update succeeds even if Kafka publish fails', async () => {
      const existing = makeTenant({ id: 't-ke' });
      prisma.tenant.findUnique.mockResolvedValue(existing);
      prisma.tenant.update.mockResolvedValue({ ...existing, name: 'Updated' });
      kafka.send.mockRejectedValue(new Error('Kafka down'));

      const result = await service.update('t-ke', { name: 'Updated' }, superAdmin);

      expect(result.data.name).toBe('Updated');
    });
  });
});

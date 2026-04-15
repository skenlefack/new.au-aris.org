import { CategoryService } from './category.service.js';

// ── Factories ──────────────────────────────────────────────────

function makePrisma() {
  return {
    knowledgeCategory: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    knowledgePublication: { count: vi.fn() },
  };
}

function makeKafka() {
  return { send: vi.fn().mockResolvedValue(undefined) };
}

const continentalManager = {
  userId: 'u-1',
  email: 'admin@au-aris.org',
  role: 'SUPER_ADMIN',
  roles: ['SUPER_ADMIN'],
  tenantId: 't-au',
  tenantLevel: 'CONTINENTAL',
  domains: [],
  locale: 'en',
} as any;

const knowledgeManager = {
  userId: 'u-km',
  email: 'km@au-aris.org',
  role: 'KNOWLEDGE_MANAGER',
  roles: ['KNOWLEDGE_MANAGER'],
  tenantId: 't-au',
  tenantLevel: 'CONTINENTAL',
  domains: [],
  locale: 'en',
} as any;

const recUser = {
  userId: 'u-2',
  email: 'rec@igad.au-aris.org',
  role: 'REC_ADMIN',
  roles: ['REC_ADMIN'],
  tenantId: 't-igad',
  tenantLevel: 'REC',
  domains: [],
  locale: 'en',
} as any;

const countryUser = {
  userId: 'u-3',
  email: 'admin@ke.au-aris.org',
  role: 'NATIONAL_ADMIN',
  roles: ['NATIONAL_ADMIN'],
  tenantId: 't-ke',
  tenantLevel: 'MEMBER_STATE',
  domains: [],
  locale: 'en',
} as any;

function makeCategory(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cat-1',
    parentId: null,
    slug: 'animal-health',
    nameEn: 'Animal Health',
    nameFr: null,
    namePt: null,
    nameAr: null,
    scope: 'CONTINENTAL',
    scopeTenantId: null,
    recParentTenantId: null,
    icon: null,
    color: null,
    sortOrder: 0,
    isSystem: false,
    isActive: true,
    status: 'APPROVED',
    submittedBy: null,
    submittedAt: null,
    reviewedBy: null,
    reviewedAt: null,
    rejectionReason: null,
    createdBy: 'u-1',
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('CategoryService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let kafka: ReturnType<typeof makeKafka>;
  let service: CategoryService;

  beforeEach(() => {
    prisma = makePrisma();
    kafka = makeKafka();
    service = new CategoryService(prisma as any, kafka as any);
  });

  // ────────────────────────────────────────────────────────────
  // create
  // ────────────────────────────────────────────────────────────

  describe('create', () => {
    it('continental manager gets auto-APPROVED status', async () => {
      prisma.knowledgeCategory.findUnique.mockResolvedValue(null); // slug check
      const created = makeCategory({ status: 'APPROVED', reviewedBy: 'u-1' });
      prisma.knowledgeCategory.create.mockResolvedValue(created);

      const result = await service.create(
        { slug: 'animal-health', nameEn: 'Animal Health', scope: 'CONTINENTAL' } as any,
        continentalManager,
      );

      expect(result.data).toEqual(created);
      const createCall = prisma.knowledgeCategory.create.mock.calls[0][0];
      expect(createCall.data.status).toBe('APPROVED');
      expect(createCall.data.reviewedBy).toBe('u-1');
      expect(createCall.data.submittedBy).toBeNull();
    });

    it('REC user gets PENDING status', async () => {
      prisma.knowledgeCategory.findUnique.mockResolvedValue(null); // slug check
      const created = makeCategory({ status: 'PENDING', submittedBy: 'u-2' });
      prisma.knowledgeCategory.create.mockResolvedValue(created);

      const result = await service.create(
        { slug: 'rec-health', nameEn: 'REC Health', scope: 'REC', scopeTenantId: 't-igad' } as any,
        recUser,
      );

      expect(result.data).toEqual(created);
      const createCall = prisma.knowledgeCategory.create.mock.calls[0][0];
      expect(createCall.data.status).toBe('PENDING');
      expect(createCall.data.submittedBy).toBe('u-2');
      expect(createCall.data.reviewedBy).toBeNull();
    });

    it('REC user cannot create CONTINENTAL category', async () => {
      await expect(
        service.create(
          { slug: 'global-cat', nameEn: 'Global', scope: 'CONTINENTAL' } as any,
          recUser,
        ),
      ).rejects.toThrow(/REC users may only propose REC or COUNTRY/);
    });

    it('country user cannot create REC category', async () => {
      await expect(
        service.create(
          { slug: 'rec-cat', nameEn: 'Regional', scope: 'REC' } as any,
          countryUser,
        ),
      ).rejects.toThrow(/Country users may only propose COUNTRY/);
    });

    it('rejects duplicate slug', async () => {
      prisma.knowledgeCategory.findUnique.mockResolvedValue(makeCategory());

      await expect(
        service.create(
          { slug: 'animal-health', nameEn: 'Animal Health', scope: 'CONTINENTAL' } as any,
          continentalManager,
        ),
      ).rejects.toThrow(/already exists/);
    });
  });

  // ────────────────────────────────────────────────────────────
  // review
  // ────────────────────────────────────────────────────────────

  describe('review', () => {
    it('approve sets status to APPROVED with reviewer info', async () => {
      const pending = makeCategory({ id: 'cat-2', status: 'PENDING', submittedBy: 'u-2' });
      prisma.knowledgeCategory.findUnique.mockResolvedValue(pending);

      const approved = { ...pending, status: 'APPROVED', reviewedBy: 'u-1', reviewedAt: new Date() };
      prisma.knowledgeCategory.update.mockResolvedValue(approved);

      const result = await service.review('cat-2', 'APPROVED', undefined, continentalManager);

      expect(result.data.status).toBe('APPROVED');
      const updateCall = prisma.knowledgeCategory.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe('APPROVED');
      expect(updateCall.data.reviewedBy).toBe('u-1');
      expect(updateCall.data.rejectionReason).toBeNull();
    });

    it('reject sets REJECTED with reason', async () => {
      const pending = makeCategory({ id: 'cat-2', status: 'PENDING', submittedBy: 'u-2' });
      prisma.knowledgeCategory.findUnique.mockResolvedValue(pending);

      const rejected = { ...pending, status: 'REJECTED', rejectionReason: 'Not needed' };
      prisma.knowledgeCategory.update.mockResolvedValue(rejected);

      const result = await service.review('cat-2', 'REJECTED', 'Not needed', continentalManager);

      expect(result.data.status).toBe('REJECTED');
      const updateCall = prisma.knowledgeCategory.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe('REJECTED');
      expect(updateCall.data.rejectionReason).toBe('Not needed');
    });

    it('non-manager throws 403', async () => {
      await expect(
        service.review('cat-2', 'APPROVED', undefined, recUser),
      ).rejects.toThrow(/continental knowledge managers/);

      const err = await service.review('cat-2', 'APPROVED', undefined, recUser).catch((e) => e);
      expect(err.statusCode).toBe(403);
    });

    it('rejects review when category is not PENDING', async () => {
      const approved = makeCategory({ id: 'cat-2', status: 'APPROVED' });
      prisma.knowledgeCategory.findUnique.mockResolvedValue(approved);

      await expect(
        service.review('cat-2', 'REJECTED', 'bad', continentalManager),
      ).rejects.toThrow(/not PENDING/);
    });
  });

  // ────────────────────────────────────────────────────────────
  // reviewQueue
  // ────────────────────────────────────────────────────────────

  describe('reviewQueue', () => {
    it('returns only PENDING categories', async () => {
      const pendingCats = [
        makeCategory({ id: 'cat-p1', status: 'PENDING' }),
        makeCategory({ id: 'cat-p2', status: 'PENDING' }),
      ];
      prisma.knowledgeCategory.findMany.mockResolvedValue(pendingCats);

      const result = await service.reviewQueue(continentalManager);

      expect(result.data).toHaveLength(2);
      expect(prisma.knowledgeCategory.findMany).toHaveBeenCalledWith({
        where: { status: 'PENDING' },
        orderBy: { submittedAt: 'asc' },
      });
    });

    it('throws 403 for non-manager', async () => {
      await expect(service.reviewQueue(recUser)).rejects.toThrow(/continental knowledge managers/);
    });
  });

  // ────────────────────────────────────────────────────────────
  // submitCategory
  // ────────────────────────────────────────────────────────────

  describe('submitCategory', () => {
    it('moves REJECTED back to PENDING', async () => {
      const rejected = makeCategory({
        id: 'cat-r1',
        status: 'REJECTED',
        scope: 'CONTINENTAL',
        rejectionReason: 'Needs work',
      });
      prisma.knowledgeCategory.findUnique.mockResolvedValue(rejected);

      const resubmitted = { ...rejected, status: 'PENDING', submittedBy: 'u-1', rejectionReason: null };
      prisma.knowledgeCategory.update.mockResolvedValue(resubmitted);

      const result = await service.submitCategory('cat-r1', continentalManager);

      expect(result.data.status).toBe('PENDING');
      const updateCall = prisma.knowledgeCategory.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe('PENDING');
      expect(updateCall.data.rejectionReason).toBeNull();
      expect(updateCall.data.submittedBy).toBe('u-1');
    });

    it('throws if category is not REJECTED', async () => {
      const approved = makeCategory({ id: 'cat-a1', status: 'APPROVED' });
      prisma.knowledgeCategory.findUnique.mockResolvedValue(approved);

      await expect(
        service.submitCategory('cat-a1', continentalManager),
      ).rejects.toThrow(/only REJECTED categories can be re-submitted/);
    });
  });

  // ────────────────────────────────────────────────────────────
  // delete
  // ────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('system category throws 400', async () => {
      const systemCat = makeCategory({ id: 'cat-sys', isSystem: true });
      prisma.knowledgeCategory.findUnique.mockResolvedValue(systemCat);

      const err = await service.delete('cat-sys', continentalManager).catch((e) => e);
      expect(err.statusCode).toBe(400);
      expect(err.message).toMatch(/System categories cannot be deleted/);
    });

    it('non-manager cannot delete system category', async () => {
      const systemCat = makeCategory({
        id: 'cat-sys',
        isSystem: true,
        scope: 'REC',
        scopeTenantId: 't-igad',
      });
      prisma.knowledgeCategory.findUnique.mockResolvedValue(systemCat);

      const err = await service.delete('cat-sys', recUser).catch((e) => e);
      expect(err.statusCode).toBe(403);
    });

    it('deletes successfully when no children or publications', async () => {
      const cat = makeCategory({ id: 'cat-del' });
      prisma.knowledgeCategory.findUnique.mockResolvedValue(cat);
      prisma.knowledgePublication.count.mockResolvedValue(0);
      prisma.knowledgeCategory.count.mockResolvedValue(0);
      prisma.knowledgeCategory.delete.mockResolvedValue(cat);

      const result = await service.delete('cat-del', continentalManager);
      expect(result.data.deleted).toBe(true);
    });

    it('rejects delete when publications exist', async () => {
      const cat = makeCategory({ id: 'cat-pub' });
      prisma.knowledgeCategory.findUnique.mockResolvedValue(cat);
      prisma.knowledgePublication.count.mockResolvedValue(3);

      await expect(service.delete('cat-pub', continentalManager)).rejects.toThrow(/3 publication/);
    });

    it('rejects delete when child categories exist', async () => {
      const cat = makeCategory({ id: 'cat-parent' });
      prisma.knowledgeCategory.findUnique.mockResolvedValue(cat);
      prisma.knowledgePublication.count.mockResolvedValue(0);
      prisma.knowledgeCategory.count.mockResolvedValue(2);

      await expect(service.delete('cat-parent', continentalManager)).rejects.toThrow(/child categories/);
    });
  });

  // ────────────────────────────────────────────────────────────
  // list
  // ────────────────────────────────────────────────────────────

  describe('list', () => {
    it('non-manager only sees APPROVED categories', async () => {
      const cats = [makeCategory({ status: 'APPROVED' })];
      prisma.knowledgeCategory.findMany.mockResolvedValue(cats);

      await service.list({}, recUser);

      const findManyCall = prisma.knowledgeCategory.findMany.mock.calls[0][0];
      expect(findManyCall.where.status).toBe('APPROVED');
    });

    it('manager with includePending sees all statuses', async () => {
      const cats = [
        makeCategory({ status: 'APPROVED' }),
        makeCategory({ id: 'cat-p', status: 'PENDING' }),
      ];
      prisma.knowledgeCategory.findMany.mockResolvedValue(cats);

      await service.list({ includePending: true }, continentalManager);

      const findManyCall = prisma.knowledgeCategory.findMany.mock.calls[0][0];
      expect(findManyCall.where.status).toBeUndefined();
    });

    it('MEMBER_STATE user gets scoped visibility', async () => {
      prisma.knowledgeCategory.findMany.mockResolvedValue([]);

      await service.list({}, countryUser);

      const findManyCall = prisma.knowledgeCategory.findMany.mock.calls[0][0];
      expect(findManyCall.where.OR).toEqual([
        { scope: 'CONTINENTAL' },
        { scope: 'REC' },
        { scope: 'COUNTRY', scopeTenantId: 't-ke' },
      ]);
    });
  });

  // ────────────────────────────────────────────────────────────
  // listPublishable
  // ────────────────────────────────────────────────────────────

  describe('listPublishable', () => {
    it('returns only APPROVED categories for user scope', async () => {
      const cats = [makeCategory({ status: 'APPROVED', scope: 'COUNTRY', scopeTenantId: 't-ke' })];
      prisma.knowledgeCategory.findMany.mockResolvedValue(cats);

      const result = await service.listPublishable(countryUser);

      expect(result.data).toEqual(cats);
      const findManyCall = prisma.knowledgeCategory.findMany.mock.calls[0][0];
      expect(findManyCall.where.status).toBe('APPROVED');
      expect(findManyCall.where.isActive).toBe(true);
      expect(findManyCall.where.scope).toBe('COUNTRY');
      expect(findManyCall.where.scopeTenantId).toBe('t-ke');
    });

    it('continental manager sees all APPROVED categories', async () => {
      const cats = [
        makeCategory({ scope: 'CONTINENTAL' }),
        makeCategory({ id: 'cat-rec', scope: 'REC', scopeTenantId: 't-igad' }),
      ];
      prisma.knowledgeCategory.findMany.mockResolvedValue(cats);

      const result = await service.listPublishable(continentalManager);

      expect(result.data).toHaveLength(2);
      const findManyCall = prisma.knowledgeCategory.findMany.mock.calls[0][0];
      // Continental manager has no scope/OR filter beyond isActive + status
      expect(findManyCall.where.OR).toBeUndefined();
      expect(findManyCall.where.scope).toBeUndefined();
    });

    it('REC user sees only own REC and child COUNTRY categories', async () => {
      prisma.knowledgeCategory.findMany.mockResolvedValue([]);

      await service.listPublishable(recUser);

      const findManyCall = prisma.knowledgeCategory.findMany.mock.calls[0][0];
      expect(findManyCall.where.OR).toEqual([
        { scope: 'REC', scopeTenantId: 't-igad' },
        { scope: 'COUNTRY', recParentTenantId: 't-igad' },
      ]);
    });
  });
});

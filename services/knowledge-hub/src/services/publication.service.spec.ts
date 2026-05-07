import { PublicationService } from './publication.service.js';

// ── Factories ──────────────────────────────────────────────────

function makePrisma() {
  return {
    knowledgePublication: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
    },
    knowledgePublicationReview: { create: vi.fn() },
    knowledgePublicationAttachment: {
      createMany: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn(),
    },
    knowledgeCategory: { findUnique: vi.fn(), count: vi.fn() },
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
  };
}

function makeKafka() {
  return { send: vi.fn().mockResolvedValue(undefined) };
}

function makeCategoryService() {
  return {
    canPublishInCategory: vi.fn().mockReturnValue(true),
  };
}

function makeSearchService() {
  return {
    index: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  };
}

const reviewer = {
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

const author = {
  userId: 'u-2',
  email: 'rec@igad.au-aris.org',
  role: 'REC_ADMIN',
  roles: ['REC_ADMIN'],
  tenantId: 't-igad',
  tenantLevel: 'REC',
  domains: [],
  locale: 'en',
} as any;

const otherUser = {
  userId: 'u-3',
  email: 'admin@ke.au-aris.org',
  role: 'NATIONAL_ADMIN',
  roles: ['NATIONAL_ADMIN'],
  tenantId: 't-ke',
  tenantLevel: 'MEMBER_STATE',
  domains: [],
  locale: 'en',
} as any;

function makePublication(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pub-1',
    tenantId: 't-igad',
    categoryId: 'cat-1',
    title: { en: 'Test Publication' },
    summary: { en: 'Summary' },
    contentHtml: { en: '<p>Hello</p>' },
    contentText: { en: 'Hello' },
    slug: 'test-publication',
    type: 'ARTICLE',
    status: 'DRAFT',
    visibility: 'PUBLIC',
    dataClassification: 'PUBLIC',
    authors: ['Author One'],
    tags: ['health'],
    coverImageId: null,
    createdBy: 'u-2',
    updatedBy: 'u-2',
    submittedAt: null,
    reviewedBy: null,
    reviewedAt: null,
    rejectionReason: null,
    publishedAt: null,
    publishedBy: null,
    archivedAt: null,
    metaTitle: null,
    metaDescription: null,
    viewCount: 0,
    downloadCount: 0,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeCategory(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cat-1',
    scope: 'REC',
    scopeTenantId: 't-igad',
    recParentTenantId: null,
    isActive: true,
    status: 'APPROVED',
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('PublicationService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let kafka: ReturnType<typeof makeKafka>;
  let categoryService: ReturnType<typeof makeCategoryService>;
  let searchService: ReturnType<typeof makeSearchService>;
  let service: PublicationService;

  beforeEach(() => {
    prisma = makePrisma();
    kafka = makeKafka();
    categoryService = makeCategoryService();
    searchService = makeSearchService();
    service = new PublicationService(
      prisma as any,
      kafka as any,
      categoryService as any,
      searchService as any,
    );
  });

  // ────────────────────────────────────────────────────────────
  // create
  // ────────────────────────────────────────────────────────────

  describe('create', () => {
    it('saves as DRAFT with correct metadata', async () => {
      const category = makeCategory();
      prisma.knowledgeCategory.findUnique.mockResolvedValue(category);

      const created = makePublication();
      prisma.knowledgePublication.create.mockResolvedValue(created);

      const result = await service.create(
        {
          categoryId: 'cat-1',
          title: { en: 'Test Publication' },
          contentHtml: { en: '<p>Hello</p>' },
          type: 'ARTICLE',
        } as any,
        author,
      );

      expect(result.data).toEqual(created);
      const createCall = prisma.knowledgePublication.create.mock.calls[0][0];
      expect(createCall.data.status).toBe('DRAFT');
      expect(createCall.data.tenantId).toBe('t-igad');
      expect(createCall.data.createdBy).toBe('u-2');
      expect(createCall.data.updatedBy).toBe('u-2');
    });

    it('throws 404 if category not found', async () => {
      prisma.knowledgeCategory.findUnique.mockResolvedValue(null);

      await expect(
        service.create(
          { categoryId: 'cat-missing', title: { en: 'X' }, contentHtml: { en: '<p>X</p>' }, type: 'ARTICLE' } as any,
          author,
        ),
      ).rejects.toThrow(/Category not found/);
    });

    it('throws 403 if user cannot publish in category', async () => {
      prisma.knowledgeCategory.findUnique.mockResolvedValue(makeCategory());
      categoryService.canPublishInCategory.mockReturnValue(false);

      const err = await service.create(
        { categoryId: 'cat-1', title: { en: 'X' }, contentHtml: { en: '<p>X</p>' }, type: 'ARTICLE' } as any,
        author,
      ).catch((e) => e);

      expect(err.statusCode).toBe(403);
      expect(err.message).toMatch(/not allowed to publish/);
    });
  });

  // ────────────────────────────────────────────────────────────
  // submit
  // ────────────────────────────────────────────────────────────

  describe('submit', () => {
    it('transitions DRAFT to SUBMITTED', async () => {
      const draft = makePublication({ status: 'DRAFT', createdBy: 'u-2', tenantId: 't-igad' });
      prisma.knowledgePublication.findUnique.mockResolvedValue(draft);

      const submitted = { ...draft, status: 'SUBMITTED', submittedAt: new Date() };
      prisma.knowledgePublication.update.mockResolvedValue(submitted);

      const result = await service.submit('pub-1', author);

      expect(result.data.status).toBe('SUBMITTED');
      const updateCall = prisma.knowledgePublication.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe('SUBMITTED');
      expect(updateCall.data.submittedAt).toBeInstanceOf(Date);
      expect(updateCall.data.rejectionReason).toBeNull();
    });

    it('throws if already SUBMITTED', async () => {
      const submitted = makePublication({ status: 'SUBMITTED', createdBy: 'u-2', tenantId: 't-igad' });
      prisma.knowledgePublication.findUnique.mockResolvedValue(submitted);

      await expect(service.submit('pub-1', author)).rejects.toThrow(
        /Only DRAFT or REJECTED publications can be submitted/,
      );
    });

    it('allows submitting REJECTED publication', async () => {
      const rejected = makePublication({ status: 'REJECTED', createdBy: 'u-2', tenantId: 't-igad' });
      prisma.knowledgePublication.findUnique.mockResolvedValue(rejected);

      const resubmitted = { ...rejected, status: 'SUBMITTED' };
      prisma.knowledgePublication.update.mockResolvedValue(resubmitted);

      const result = await service.submit('pub-1', author);
      expect(result.data.status).toBe('SUBMITTED');
    });

    it('throws 403 if not the creator and not a reviewer', async () => {
      const draft = makePublication({ status: 'DRAFT', createdBy: 'u-2', tenantId: 't-ke' });
      prisma.knowledgePublication.findUnique.mockResolvedValue(draft);

      await expect(service.submit('pub-1', otherUser)).rejects.toThrow(
        /You can only submit your own publications/,
      );
    });
  });

  // ────────────────────────────────────────────────────────────
  // review
  // ────────────────────────────────────────────────────────────

  describe('review', () => {
    it('APPROVED sets status and reviewer', async () => {
      const submitted = makePublication({ status: 'SUBMITTED' });
      prisma.knowledgePublication.findUnique.mockResolvedValue(submitted);

      const approved = { ...submitted, status: 'APPROVED', reviewedBy: 'u-1' };
      prisma.$transaction.mockImplementation(async (fn: any) => fn({
        knowledgePublicationReview: { create: vi.fn().mockResolvedValue({}) },
        knowledgePublication: { update: vi.fn().mockResolvedValue(approved) },
      }));

      const result = await service.review('pub-1', { decision: 'APPROVED' } as any, reviewer);

      expect(result.data.status).toBe('APPROVED');
      expect(result.data.reviewedBy).toBe('u-1');
    });

    it('REJECTED sets rejection reason', async () => {
      const submitted = makePublication({ status: 'SUBMITTED' });
      prisma.knowledgePublication.findUnique.mockResolvedValue(submitted);

      const rejected = { ...submitted, status: 'REJECTED', rejectionReason: 'Low quality', reviewedBy: 'u-1' };
      prisma.$transaction.mockImplementation(async (fn: any) => fn({
        knowledgePublicationReview: { create: vi.fn().mockResolvedValue({}) },
        knowledgePublication: {
          update: vi.fn().mockResolvedValue(rejected),
        },
      }));

      const result = await service.review(
        'pub-1',
        { decision: 'REJECTED', comment: 'Low quality' } as any,
        reviewer,
      );

      expect(result.data.status).toBe('REJECTED');
      expect(result.data.rejectionReason).toBe('Low quality');
    });

    it('COMMENT keeps UNDER_REVIEW status', async () => {
      const submitted = makePublication({ status: 'SUBMITTED' });
      prisma.knowledgePublication.findUnique.mockResolvedValue(submitted);

      const underReview = { ...submitted, status: 'UNDER_REVIEW', reviewedBy: 'u-1' };
      prisma.$transaction.mockImplementation(async (fn: any) => fn({
        knowledgePublicationReview: { create: vi.fn().mockResolvedValue({}) },
        knowledgePublication: {
          update: vi.fn().mockResolvedValue(underReview),
        },
      }));

      const result = await service.review(
        'pub-1',
        { decision: 'COMMENT', comment: 'Looks good, minor edits needed' } as any,
        reviewer,
      );

      expect(result.data.status).toBe('UNDER_REVIEW');
    });

    it('throws 403 for non-reviewer', async () => {
      const err = await service.review(
        'pub-1',
        { decision: 'APPROVED' } as any,
        author,
      ).catch((e) => e);

      expect(err.statusCode).toBe(403);
      expect(err.message).toMatch(/Only knowledge managers/);
    });

    it('throws 409 if publication is not SUBMITTED or UNDER_REVIEW', async () => {
      const draft = makePublication({ status: 'DRAFT' });
      prisma.knowledgePublication.findUnique.mockResolvedValue(draft);

      await expect(
        service.review('pub-1', { decision: 'APPROVED' } as any, reviewer),
      ).rejects.toThrow(/Cannot review publication in status DRAFT/);
    });
  });

  // ────────────────────────────────────────────────────────────
  // publish
  // ────────────────────────────────────────────────────────────

  describe('publish', () => {
    it('APPROVED to PUBLISHED with publishedAt', async () => {
      const approved = makePublication({ status: 'APPROVED' });
      prisma.knowledgePublication.findUnique.mockResolvedValue(approved);

      const published = {
        ...approved,
        status: 'PUBLISHED',
        publishedAt: new Date(),
        publishedBy: 'u-1',
      };
      prisma.knowledgePublication.update.mockResolvedValue(published);

      const result = await service.publish('pub-1', reviewer);

      expect(result.data.status).toBe('PUBLISHED');
      expect(result.data.publishedAt).toBeInstanceOf(Date);
      expect(result.data.publishedBy).toBe('u-1');

      const updateCall = prisma.knowledgePublication.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe('PUBLISHED');
      expect(updateCall.data.publishedBy).toBe('u-1');
      expect(updateCall.data.publishedAt).toBeInstanceOf(Date);

      // Verify search indexing was called
      expect(searchService.index).toHaveBeenCalledWith(published);
    });

    it('throws if not APPROVED', async () => {
      const submitted = makePublication({ status: 'SUBMITTED' });
      prisma.knowledgePublication.findUnique.mockResolvedValue(submitted);

      await expect(service.publish('pub-1', reviewer)).rejects.toThrow(
        /Only APPROVED publications can be published/,
      );
    });

    it('throws 403 for non-reviewer', async () => {
      const err = await service.publish('pub-1', author).catch((e) => e);
      expect(err.statusCode).toBe(403);
      expect(err.message).toMatch(/Only knowledge managers/);
    });
  });

  // ────────────────────────────────────────────────────────────
  // archive
  // ────────────────────────────────────────────────────────────

  describe('archive', () => {
    it('PUBLISHED to ARCHIVED', async () => {
      const published = makePublication({ status: 'PUBLISHED' });
      prisma.knowledgePublication.findUnique.mockResolvedValue(published);

      const archived = { ...published, status: 'ARCHIVED', archivedAt: new Date() };
      prisma.knowledgePublication.update.mockResolvedValue(archived);

      const result = await service.archive('pub-1', reviewer);

      expect(result.data.status).toBe('ARCHIVED');
      const updateCall = prisma.knowledgePublication.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe('ARCHIVED');
      expect(updateCall.data.archivedAt).toBeInstanceOf(Date);

      // Verify search removal
      expect(searchService.remove).toHaveBeenCalledWith('pub-1');
    });

    it('throws 403 for non-reviewer', async () => {
      const err = await service.archive('pub-1', author).catch((e) => e);
      expect(err.statusCode).toBe(403);
    });
  });

  // ────────────────────────────────────────────────────────────
  // delete
  // ────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('creator can delete DRAFT', async () => {
      const draft = makePublication({ status: 'DRAFT', createdBy: 'u-2', tenantId: 't-igad' });
      prisma.knowledgePublication.findUnique.mockResolvedValue(draft);
      prisma.knowledgePublication.delete.mockResolvedValue(draft);

      const result = await service.delete('pub-1', author);

      expect(result.data.deleted).toBe(true);
      expect(prisma.knowledgePublication.delete).toHaveBeenCalledWith({ where: { id: 'pub-1' } });
      expect(searchService.remove).toHaveBeenCalledWith('pub-1');
    });

    it('throws if PUBLISHED and user is not reviewer', async () => {
      const published = makePublication({ status: 'PUBLISHED', createdBy: 'u-2', tenantId: 't-igad' });
      prisma.knowledgePublication.findUnique.mockResolvedValue(published);

      const err = await service.delete('pub-1', author).catch((e) => e);
      expect(err.statusCode).toBe(403);
      expect(err.message).toMatch(/Published items can only be deleted by a knowledge manager/);
    });

    it('reviewer can delete PUBLISHED publication', async () => {
      const published = makePublication({ status: 'PUBLISHED', createdBy: 'u-2' });
      prisma.knowledgePublication.findUnique.mockResolvedValue(published);
      prisma.knowledgePublication.delete.mockResolvedValue(published);

      const result = await service.delete('pub-1', reviewer);
      expect(result.data.deleted).toBe(true);
    });

    it('throws 403 if non-creator and non-reviewer', async () => {
      const draft = makePublication({ status: 'DRAFT', createdBy: 'u-2', tenantId: 't-ke' });
      prisma.knowledgePublication.findUnique.mockResolvedValue(draft);

      const err = await service.delete('pub-1', otherUser).catch((e) => e);
      expect(err.statusCode).toBe(403);
    });

    it('throws 404 if publication not found', async () => {
      prisma.knowledgePublication.findUnique.mockResolvedValue(null);

      await expect(service.delete('pub-missing', author)).rejects.toThrow(/Publication not found/);
    });
  });

  // ────────────────────────────────────────────────────────────
  // update
  // ────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates title/summary/content for DRAFT publication', async () => {
      const draft = makePublication({ status: 'DRAFT', createdBy: 'u-2', tenantId: 't-igad' });
      prisma.knowledgePublication.findUnique.mockResolvedValue(draft);

      const updated = { ...draft, title: { en: 'Updated Title' }, summary: { en: 'New summary' } };
      prisma.knowledgePublication.update.mockResolvedValue(updated);

      const result = await service.update(
        'pub-1',
        { title: { en: 'Updated Title' }, summary: { en: 'New summary' }, contentHtml: { en: '<p>New</p>' } } as any,
        author,
      );

      expect(result.data.title).toEqual({ en: 'Updated Title' });
      const updateCall = prisma.knowledgePublication.update.mock.calls[0][0];
      expect(updateCall.data.title).toEqual({ en: 'Updated Title' });
      expect(updateCall.data.summary).toEqual({ en: 'New summary' });
      expect(updateCall.data.updatedBy).toBe('u-2');
    });

    it('allows update of REJECTED publication by author', async () => {
      const rejected = makePublication({ status: 'REJECTED', createdBy: 'u-2', tenantId: 't-igad' });
      prisma.knowledgePublication.findUnique.mockResolvedValue(rejected);

      const updated = { ...rejected, status: 'DRAFT', title: { en: 'Fixed Title' }, rejectionReason: null };
      prisma.knowledgePublication.update.mockResolvedValue(updated);

      const result = await service.update(
        'pub-1',
        { title: { en: 'Fixed Title' } } as any,
        author,
      );

      expect(result.data.status).toBe('DRAFT');
      expect(result.data.rejectionReason).toBeNull();
      const updateCall = prisma.knowledgePublication.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe('DRAFT');
      expect(updateCall.data.rejectionReason).toBeNull();
    });

    it('rejects update if publication not found (404)', async () => {
      prisma.knowledgePublication.findUnique.mockResolvedValue(null);

      const err = await service.update('pub-missing', { title: { en: 'X' } } as any, author).catch((e) => e);
      expect(err.statusCode).toBe(404);
      expect(err.message).toMatch(/Publication not found/);
    });

    it('rejects update if user is not author and not reviewer (403)', async () => {
      const draft = makePublication({ status: 'DRAFT', createdBy: 'u-2', tenantId: 't-ke' });
      prisma.knowledgePublication.findUnique.mockResolvedValue(draft);

      const err = await service.update('pub-1', { title: { en: 'X' } } as any, otherUser).catch((e) => e);
      expect(err.statusCode).toBe(403);
    });

    it('updates attachments (add/remove)', async () => {
      const draft = makePublication({ status: 'DRAFT', createdBy: 'u-2', tenantId: 't-igad' });
      prisma.knowledgePublication.findUnique.mockResolvedValue(draft);

      const updated = { ...draft };
      prisma.knowledgePublication.update.mockResolvedValue(updated);

      await service.update(
        'pub-1',
        {
          attachments: [
            { fileId: 'file-1', kind: 'DOCUMENT', sortOrder: 0 },
            { fileId: 'file-2', kind: 'IMAGE', caption: 'Cover', sortOrder: 1 },
          ],
        } as any,
        author,
      );

      const updateCall = prisma.knowledgePublication.update.mock.calls[0][0];
      expect(updateCall.data.attachments.deleteMany).toEqual({});
      expect(updateCall.data.attachments.create).toHaveLength(2);
      expect(updateCall.data.attachments.create[0].fileId).toBe('file-1');
      expect(updateCall.data.attachments.create[1].caption).toBe('Cover');
    });
  });

  // ────────────────────────────────────────────────────────────
  // findOne
  // ────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns publication with full details', async () => {
      const pub = makePublication({ status: 'PUBLISHED', visibility: 'PUBLIC' });
      prisma.knowledgePublication.findUnique.mockResolvedValue(pub);
      prisma.knowledgePublication.update.mockResolvedValue(pub); // view count increment

      const result = await service.findOne('pub-1', reviewer);

      expect(result.data).toEqual(pub);
      expect(prisma.knowledgePublication.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pub-1' },
          include: expect.objectContaining({ category: true }),
        }),
      );
    });

    it('increments view count for PUBLISHED publication (best-effort)', async () => {
      const pub = makePublication({ status: 'PUBLISHED', visibility: 'PUBLIC' });
      prisma.knowledgePublication.findUnique.mockResolvedValue(pub);
      prisma.knowledgePublication.update.mockResolvedValue(pub);

      await service.findOne('pub-1', null);

      // View count increment is fire-and-forget; verify update was called
      expect(prisma.knowledgePublication.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pub-1' },
          data: { viewCount: { increment: 1 } },
        }),
      );
    });

    it('returns 404 when not found', async () => {
      prisma.knowledgePublication.findUnique.mockResolvedValue(null);

      const err = await service.findOne('pub-gone', reviewer).catch((e) => e);
      expect(err.statusCode).toBe(404);
      expect(err.message).toMatch(/Publication not found/);
    });

    it('rejects if user lacks read access (403/404)', async () => {
      // DRAFT publication, not the author, not a reviewer, not public
      const draft = makePublication({ status: 'DRAFT', createdBy: 'u-2', visibility: 'PRIVATE' });
      prisma.knowledgePublication.findUnique.mockResolvedValue(draft);

      const err = await service.findOne('pub-1', otherUser).catch((e) => e);
      expect(err.statusCode).toBe(404); // assertReadAccess throws 404 to hide existence
    });
  });

  // ────────────────────────────────────────────────────────────
  // findBySlug
  // ────────────────────────────────────────────────────────────

  describe('findBySlug', () => {
    it('returns published publication by slug', async () => {
      const pub = makePublication({ status: 'PUBLISHED', visibility: 'PUBLIC', slug: 'test-slug' });
      prisma.knowledgePublication.findUnique.mockResolvedValue(pub);

      const result = await service.findBySlug('test-slug', null);

      expect(result.data).toEqual(pub);
      expect(prisma.knowledgePublication.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { slug: 'test-slug' } }),
      );
    });

    it('returns 404 for non-existent slug', async () => {
      prisma.knowledgePublication.findUnique.mockResolvedValue(null);

      const err = await service.findBySlug('no-such-slug', null).catch((e) => e);
      expect(err.statusCode).toBe(404);
      expect(err.message).toMatch(/Publication not found/);
    });
  });

  // ────────────────────────────────────────────────────────────
  // findAll
  // ────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns paginated results', async () => {
      const pubs = [makePublication({ id: 'pub-a' }), makePublication({ id: 'pub-b' })];
      prisma.knowledgePublication.findMany.mockResolvedValue(pubs);
      prisma.knowledgePublication.count.mockResolvedValue(2);

      const result = await service.findAll(reviewer, { page: 1, limit: 10 } as any);

      expect(result.data).toHaveLength(2);
      expect(result.meta).toEqual({ total: 2, page: 1, limit: 10 });
    });

    it('filters by status', async () => {
      prisma.knowledgePublication.findMany.mockResolvedValue([]);
      prisma.knowledgePublication.count.mockResolvedValue(0);

      await service.findAll(reviewer, { status: 'PUBLISHED' } as any);

      const findCall = prisma.knowledgePublication.findMany.mock.calls[0][0];
      expect(findCall.where.status).toBe('PUBLISHED');
    });

    it('filters by categoryId', async () => {
      prisma.knowledgePublication.findMany.mockResolvedValue([]);
      prisma.knowledgePublication.count.mockResolvedValue(0);

      await service.findAll(reviewer, { categoryId: 'cat-1' } as any);

      const findCall = prisma.knowledgePublication.findMany.mock.calls[0][0];
      expect(findCall.where.categoryId).toBe('cat-1');
    });

    it('filters by type', async () => {
      prisma.knowledgePublication.findMany.mockResolvedValue([]);
      prisma.knowledgePublication.count.mockResolvedValue(0);

      await service.findAll(reviewer, { type: 'ARTICLE' } as any);

      const findCall = prisma.knowledgePublication.findMany.mock.calls[0][0];
      expect(findCall.where.type).toBe('ARTICLE');
    });

    it('filters by "mine" (only user publications)', async () => {
      prisma.knowledgePublication.findMany.mockResolvedValue([]);
      prisma.knowledgePublication.count.mockResolvedValue(0);

      await service.findAll(author, { mine: true } as any);

      const findCall = prisma.knowledgePublication.findMany.mock.calls[0][0];
      expect(findCall.where.createdBy).toBe('u-2');
    });

    it('respects visibility rules (non-reviewer sees only own + PUBLISHED)', async () => {
      prisma.knowledgePublication.findMany.mockResolvedValue([]);
      prisma.knowledgePublication.count.mockResolvedValue(0);

      await service.findAll(otherUser, {} as any);

      const findCall = prisma.knowledgePublication.findMany.mock.calls[0][0];
      expect(findCall.where.OR).toEqual([
        { createdBy: 'u-3' },
        { status: 'PUBLISHED', visibility: { in: ['PUBLIC', 'PRIVATE'] } },
      ]);
    });

    it('unauthenticated user sees only PUBLISHED + PUBLIC', async () => {
      prisma.knowledgePublication.findMany.mockResolvedValue([]);
      prisma.knowledgePublication.count.mockResolvedValue(0);

      await service.findAll(null, {} as any);

      const findCall = prisma.knowledgePublication.findMany.mock.calls[0][0];
      expect(findCall.where.status).toBe('PUBLISHED');
      expect(findCall.where.visibility).toBe('PUBLIC');
    });
  });

  // ────────────────────────────────────────────────────────────
  // publicStats
  // ────────────────────────────────────────────────────────────

  describe('publicStats', () => {
    it('returns publication count, category count, view total, contributing tenants', async () => {
      prisma.knowledgePublication.count.mockResolvedValue(42);
      (prisma as any).knowledgeCategory.count.mockResolvedValue(8);
      prisma.knowledgePublication.findMany.mockResolvedValue([
        { tenantId: 't-igad' },
        { tenantId: 't-ke' },
        { tenantId: 't-et' },
      ]);
      prisma.knowledgePublication.aggregate.mockResolvedValue({
        _sum: { viewCount: 1500 },
      });

      const result = await service.publicStats();

      expect(result.data.publications).toBe(42);
      expect(result.data.categories).toBe(8);
      expect(result.data.contributingTenants).toBe(3);
      expect(result.data.totalViews).toBe(1500);
    });

    it('handles zero views gracefully', async () => {
      prisma.knowledgePublication.count.mockResolvedValue(0);
      (prisma as any).knowledgeCategory.count.mockResolvedValue(0);
      prisma.knowledgePublication.findMany.mockResolvedValue([]);
      prisma.knowledgePublication.aggregate.mockResolvedValue({
        _sum: { viewCount: null },
      });

      const result = await service.publicStats();

      expect(result.data.totalViews).toBe(0);
      expect(result.data.contributingTenants).toBe(0);
    });
  });

  // ────────────────────────────────────────────────────────────
  // allTags / publicPopularTags
  // ────────────────────────────────────────────────────────────

  describe('allTags', () => {
    it('returns distinct tags from all publications', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { tag: 'avian-flu' },
        { tag: 'fisheries' },
        { tag: 'trade' },
      ]);

      const result = await service.allTags();

      expect(result.data).toEqual(['avian-flu', 'fisheries', 'trade']);
    });
  });

  describe('publicPopularTags', () => {
    it('returns top tags by frequency', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { tag: 'health', count: BigInt(25) },
        { tag: 'trade', count: BigInt(12) },
        { tag: 'fisheries', count: BigInt(8) },
      ]);

      const result = await service.publicPopularTags(3);

      expect(result.data).toEqual([
        { tag: 'health', count: 25 },
        { tag: 'trade', count: 12 },
        { tag: 'fisheries', count: 8 },
      ]);
      expect(result.data).toHaveLength(3);
    });
  });

  // ────────────────────────────────────────────────────────────
  // reviewQueue
  // ────────────────────────────────────────────────────────────

  describe('reviewQueue', () => {
    it('returns SUBMITTED and UNDER_REVIEW publications', async () => {
      const queue = [
        makePublication({ id: 'pub-s1', status: 'SUBMITTED' }),
        makePublication({ id: 'pub-ur1', status: 'UNDER_REVIEW' }),
      ];
      prisma.knowledgePublication.findMany.mockResolvedValue(queue);

      const result = await service.reviewQueue(reviewer);

      expect(result.data).toHaveLength(2);
      expect(prisma.knowledgePublication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
          orderBy: { submittedAt: 'asc' },
        }),
      );
    });

    it('throws 403 for non-reviewer', async () => {
      const err = await service.reviewQueue(author).catch((e) => e);
      expect(err.statusCode).toBe(403);
    });
  });
});

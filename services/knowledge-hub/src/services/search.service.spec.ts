import { SearchService } from './search.service.js';

// ── Mocks ─────────────────────────────────────────────────────

const mockOsClient = {
  indices: {
    exists: vi.fn(),
    create: vi.fn(),
  },
  index: vi.fn(),
  delete: vi.fn(),
  search: vi.fn(),
};

vi.mock('@opensearch-project/opensearch', () => ({
  Client: vi.fn().mockImplementation(() => mockOsClient),
}));

function makePrisma() {
  return {
    knowledgePublication: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  };
}

function makePublication(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pub-1',
    tenantId: 't-au',
    categoryId: 'cat-1',
    slug: 'test-article',
    title: { en: 'Test Article', fr: 'Article Test' },
    summary: { en: 'A summary', fr: 'Un resume' },
    contentText: { en: 'Full content here', fr: 'Contenu complet ici' },
    contentHtml: { en: '<p>Full content here</p>' },
    type: 'ARTICLE',
    status: 'PUBLISHED',
    visibility: 'PUBLIC',
    tags: ['health', 'africa'],
    authors: ['Author One'],
    publishedAt: '2026-04-01T00:00:00.000Z',
    category: {
      slug: 'animal-health',
      scope: 'CONTINENTAL',
      scopeTenantId: null,
    },
    ...overrides,
  };
}

function makeOsSearchResponse(hits: any[] = [], aggregations: any = {}) {
  return {
    body: {
      hits: {
        total: { value: hits.length },
        hits: hits.map((h) => ({
          _id: h.id,
          _source: {
            slug: h.slug ?? 'test-slug',
            title: h.title ?? { en: 'Title' },
            summary: h.summary ?? null,
            type: h.type ?? 'ARTICLE',
            categoryId: h.categoryId ?? 'cat-1',
            categorySlug: h.categorySlug ?? 'animal-health',
            scope: h.scope ?? 'CONTINENTAL',
            scopeTenantId: h.scopeTenantId ?? null,
            publishedAt: h.publishedAt ?? '2026-04-01',
            tags: h.tags ?? [],
            authors: h.authors ?? [],
            visibility: h.visibility ?? 'PUBLIC',
          },
          highlight: h.highlight,
        })),
      },
      aggregations: {
        categories: { buckets: aggregations.categories ?? [] },
        types: { buckets: aggregations.types ?? [] },
        scopes: { buckets: aggregations.scopes ?? [] },
      },
    },
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('SearchService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: SearchService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new SearchService(prisma as any);

    // Reset all mocks
    vi.clearAllMocks();

    // Default: index does not exist yet
    mockOsClient.indices.exists.mockResolvedValue({ body: false });
    mockOsClient.indices.create.mockResolvedValue({ body: {} });
    mockOsClient.index.mockResolvedValue({ body: {} });
    mockOsClient.delete.mockResolvedValue({ body: {} });
    mockOsClient.search.mockResolvedValue(makeOsSearchResponse());
  });

  // ────────────────────────────────────────────────────────────
  // ensureIndex
  // ────────────────────────────────────────────────────────────

  describe('ensureIndex', () => {
    it('should create index when it does not exist', async () => {
      mockOsClient.indices.exists.mockResolvedValue({ body: false });
      mockOsClient.indices.create.mockResolvedValue({ body: {} });

      await service.ensureIndex();

      expect(mockOsClient.indices.exists).toHaveBeenCalledWith({ index: 'aris-knowledge' });
      expect(mockOsClient.indices.create).toHaveBeenCalledWith(
        expect.objectContaining({ index: 'aris-knowledge' }),
      );
    });

    it('should skip creation when index already exists', async () => {
      mockOsClient.indices.exists.mockResolvedValue({ body: true });

      await service.ensureIndex();

      expect(mockOsClient.indices.exists).toHaveBeenCalledWith({ index: 'aris-knowledge' });
      expect(mockOsClient.indices.create).not.toHaveBeenCalled();
    });

    it('should not call indices.exists again after successful ensureIndex', async () => {
      mockOsClient.indices.exists.mockResolvedValue({ body: true });

      await service.ensureIndex();
      await service.ensureIndex();

      // Should only check once — second call returns early because indexReady=true
      expect(mockOsClient.indices.exists).toHaveBeenCalledTimes(1);
    });

    it('should handle OpenSearch connection errors gracefully', async () => {
      mockOsClient.indices.exists.mockRejectedValue(new Error('ECONNREFUSED'));

      // Should not throw
      await service.ensureIndex();

      // After failure, indexReady stays false — next call should retry
      mockOsClient.indices.exists.mockResolvedValue({ body: true });
      await service.ensureIndex();
      expect(mockOsClient.indices.exists).toHaveBeenCalledTimes(2);
    });
  });

  // ────────────────────────────────────────────────────────────
  // index
  // ────────────────────────────────────────────────────────────

  describe('index', () => {
    it('should index a PUBLISHED publication with all multilingual fields', async () => {
      mockOsClient.indices.exists.mockResolvedValue({ body: true });

      const pub = makePublication();
      await service.index(pub);

      expect(mockOsClient.index).toHaveBeenCalledWith(
        expect.objectContaining({
          index: 'aris-knowledge',
          id: 'pub-1',
          body: expect.objectContaining({
            tenantId: 't-au',
            categoryId: 'cat-1',
            categorySlug: 'animal-health',
            slug: 'test-article',
            type: 'ARTICLE',
            status: 'PUBLISHED',
            visibility: 'PUBLIC',
            scope: 'CONTINENTAL',
            scopeTenantId: null,
            tags: ['health', 'africa'],
            authors: ['Author One'],
            title_en: 'Test Article',
            title_fr: 'Article Test',
            summary_en: 'A summary',
            summary_fr: 'Un resume',
            content_en: 'Full content here',
            content_fr: 'Contenu complet ici',
          }),
          refresh: 'wait_for',
        }),
      );
    });

    it('should handle missing multilingual fields gracefully', async () => {
      mockOsClient.indices.exists.mockResolvedValue({ body: true });

      const pub = makePublication({
        title: { en: 'English Only' },
        summary: null,
        contentText: null,
      });
      await service.index(pub);

      expect(mockOsClient.index).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            title_en: 'English Only',
            title_fr: null,
            title_pt: null,
            title_ar: null,
            summary_en: null,
            summary_fr: null,
            content_en: null,
            content_fr: null,
          }),
        }),
      );
    });

    it('should handle indexing errors gracefully (log, do not throw)', async () => {
      mockOsClient.indices.exists.mockResolvedValue({ body: true });
      mockOsClient.index.mockRejectedValue(new Error('OpenSearch write error'));

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Should not throw
      await service.index(makePublication());

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to index publication pub-1'),
      );
      warnSpy.mockRestore();
    });

    it('should call ensureIndex and skip indexing if index not ready', async () => {
      // ensureIndex will fail → indexReady stays false
      mockOsClient.indices.exists.mockRejectedValue(new Error('ECONNREFUSED'));

      vi.spyOn(console, 'warn').mockImplementation(() => {});

      await service.index(makePublication());

      // index() should NOT be called because indexReady is false
      expect(mockOsClient.index).not.toHaveBeenCalled();

      vi.restoreAllMocks();
    });
  });

  // ────────────────────────────────────────────────────────────
  // remove
  // ────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('should remove a document by ID', async () => {
      mockOsClient.indices.exists.mockResolvedValue({ body: true });

      // Need to make indexReady=true first
      await service.ensureIndex();

      await service.remove('pub-1');

      expect(mockOsClient.delete).toHaveBeenCalledWith({
        index: 'aris-knowledge',
        id: 'pub-1',
        refresh: 'wait_for',
      });
    });

    it('should handle removal errors gracefully', async () => {
      mockOsClient.indices.exists.mockResolvedValue({ body: true });
      await service.ensureIndex();

      mockOsClient.delete.mockRejectedValue(new Error('Not found'));

      // Should not throw
      await service.remove('pub-missing');
    });

    it('should skip removal if index not ready', async () => {
      mockOsClient.indices.exists.mockRejectedValue(new Error('ECONNREFUSED'));

      vi.spyOn(console, 'warn').mockImplementation(() => {});
      await service.remove('pub-1');
      vi.restoreAllMocks();

      expect(mockOsClient.delete).not.toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────────────────────────
  // search
  // ────────────────────────────────────────────────────────────

  describe('search', () => {
    it('should perform OpenSearch search with query, filters, and pagination', async () => {
      mockOsClient.indices.exists.mockResolvedValue({ body: true });

      const osResponse = makeOsSearchResponse(
        [{ id: 'pub-1', slug: 'test', title: { en: 'Test' }, type: 'ARTICLE' }],
        {
          categories: [{ key: 'cat-1', doc_count: 5 }],
          types: [{ key: 'ARTICLE', doc_count: 3 }],
          scopes: [{ key: 'CONTINENTAL', doc_count: 10 }],
        },
      );
      mockOsClient.search.mockResolvedValue(osResponse);

      const result = await service.search({
        q: 'animal health',
        page: 2,
        limit: 10,
        categoryId: 'cat-1',
        type: 'ARTICLE',
        lang: 'en',
      });

      expect(result.total).toBe(1);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.hits).toHaveLength(1);
      expect(result.hits[0].id).toBe('pub-1');

      // Verify the search call
      const searchCall = mockOsClient.search.mock.calls[0][0];
      expect(searchCall.index).toBe('aris-knowledge');
      expect(searchCall.body.from).toBe(10); // (page 2 - 1) * limit 10
      expect(searchCall.body.size).toBe(10);

      // Verify facets are mapped
      expect(result.facets.categories).toEqual([{ id: 'cat-1', count: 5 }]);
      expect(result.facets.types).toEqual([{ value: 'ARTICLE', count: 3 }]);
      expect(result.facets.scopes).toEqual([{ value: 'CONTINENTAL', count: 10 }]);
    });

    it('should return hits with highlights', async () => {
      mockOsClient.indices.exists.mockResolvedValue({ body: true });

      const osResponse = makeOsSearchResponse([
        {
          id: 'pub-1',
          slug: 'test',
          highlight: {
            content_en: ['<em>animal</em> health outbreak'],
            content_fr: ['<em>sante</em> animale'],
          },
        },
      ]);
      mockOsClient.search.mockResolvedValue(osResponse);

      const result = await service.search({ q: 'animal' });

      expect(result.hits[0].highlight).toBe(
        '<em>animal</em> health outbreak … <em>sante</em> animale',
      );
    });

    it('should fall back to Postgres when OpenSearch unavailable (indexReady=false)', async () => {
      mockOsClient.indices.exists.mockRejectedValue(new Error('ECONNREFUSED'));

      vi.spyOn(console, 'warn').mockImplementation(() => {});

      const dbPubs = [
        {
          id: 'pub-db-1',
          slug: 'db-article',
          title: { en: 'DB Article' },
          summary: { en: 'Summary' },
          type: 'ARTICLE',
          categoryId: 'cat-1',
          tags: ['health'],
          authors: ['Author'],
          publishedAt: new Date('2026-04-01'),
          visibility: 'PUBLIC',
          category: { slug: 'animal-health', scope: 'CONTINENTAL', scopeTenantId: null },
        },
      ];
      prisma.knowledgePublication.findMany.mockResolvedValue(dbPubs);
      prisma.knowledgePublication.count.mockResolvedValue(1);

      const result = await service.search({ page: 1, limit: 12 });

      expect(result.total).toBe(1);
      expect(result.hits).toHaveLength(1);
      expect(result.hits[0].id).toBe('pub-db-1');
      expect(result.hits[0].slug).toBe('db-article');
      // Fallback has empty facets
      expect(result.facets).toEqual({ categories: [], types: [], scopes: [] });

      expect(prisma.knowledgePublication.findMany).toHaveBeenCalled();
      expect(mockOsClient.search).not.toHaveBeenCalled();

      vi.restoreAllMocks();
    });

    it('should fall back to Postgres when OpenSearch search throws', async () => {
      mockOsClient.indices.exists.mockResolvedValue({ body: true });
      mockOsClient.search.mockRejectedValue(new Error('search_phase_execution_exception'));

      vi.spyOn(console, 'warn').mockImplementation(() => {});

      prisma.knowledgePublication.findMany.mockResolvedValue([]);
      prisma.knowledgePublication.count.mockResolvedValue(0);

      const result = await service.search({ q: 'test' });

      expect(result.total).toBe(0);
      expect(result.hits).toHaveLength(0);
      expect(prisma.knowledgePublication.findMany).toHaveBeenCalled();

      vi.restoreAllMocks();
    });

    it('should handle empty query (return all published, sorted by date)', async () => {
      mockOsClient.indices.exists.mockResolvedValue({ body: true });

      const osResponse = makeOsSearchResponse([
        { id: 'pub-1', slug: 'a' },
        { id: 'pub-2', slug: 'b' },
      ]);
      mockOsClient.search.mockResolvedValue(osResponse);

      const result = await service.search({});

      expect(result.hits).toHaveLength(2);

      // Verify sort is by publishedAt desc when no query
      const searchCall = mockOsClient.search.mock.calls[0][0];
      expect(searchCall.body.sort).toEqual([{ publishedAt: 'desc' }]);

      // Verify no highlight config when no query
      expect(searchCall.body.highlight).toBeUndefined();
    });

    it('should apply filters: categoryId, type, scope, scopeTenantId', async () => {
      mockOsClient.indices.exists.mockResolvedValue({ body: true });
      mockOsClient.search.mockResolvedValue(makeOsSearchResponse());

      await service.search({
        categoryId: 'cat-1',
        type: 'BRIEF',
        scope: 'REC',
        scopeTenantId: 't-igad',
      });

      const searchCall = mockOsClient.search.mock.calls[0][0];
      const filters = searchCall.body.query.bool.filter;

      expect(filters).toEqual(
        expect.arrayContaining([
          { term: { categoryId: 'cat-1' } },
          { term: { type: 'BRIEF' } },
          { term: { scope: 'REC' } },
          { term: { scopeTenantId: 't-igad' } },
        ]),
      );
    });

    it('should clamp limit to 50', async () => {
      mockOsClient.indices.exists.mockResolvedValue({ body: true });
      mockOsClient.search.mockResolvedValue(makeOsSearchResponse());

      const result = await service.search({ limit: 200 });

      expect(result.limit).toBe(50);
      const searchCall = mockOsClient.search.mock.calls[0][0];
      expect(searchCall.body.size).toBe(50);
    });

    it('should default page to 1 and limit to 12', async () => {
      mockOsClient.indices.exists.mockResolvedValue({ body: true });
      mockOsClient.search.mockResolvedValue(makeOsSearchResponse());

      const result = await service.search({});

      expect(result.page).toBe(1);
      expect(result.limit).toBe(12);
      const searchCall = mockOsClient.search.mock.calls[0][0];
      expect(searchCall.body.from).toBe(0);
      expect(searchCall.body.size).toBe(12);
    });

    it('should include must terms for PUBLISHED status and PUBLIC visibility', async () => {
      mockOsClient.indices.exists.mockResolvedValue({ body: true });
      mockOsClient.search.mockResolvedValue(makeOsSearchResponse());

      await service.search({});

      const searchCall = mockOsClient.search.mock.calls[0][0];
      const must = searchCall.body.query.bool.must;

      expect(must).toEqual(
        expect.arrayContaining([
          { term: { status: 'PUBLISHED' } },
          { term: { visibility: 'PUBLIC' } },
        ]),
      );
    });

    it('should use multi_match with boosted language fields when query provided', async () => {
      mockOsClient.indices.exists.mockResolvedValue({ body: true });
      mockOsClient.search.mockResolvedValue(makeOsSearchResponse());

      await service.search({ q: 'outbreak', lang: 'fr' });

      const searchCall = mockOsClient.search.mock.calls[0][0];
      const must = searchCall.body.query.bool.must;
      const multiMatch = must.find((m: any) => m.multi_match);

      expect(multiMatch).toBeDefined();
      expect(multiMatch.multi_match.query).toBe('outbreak');
      expect(multiMatch.multi_match.fields).toContain('title_fr^4');
      expect(multiMatch.multi_match.fields).toContain('summary_fr^2');
      expect(multiMatch.multi_match.fields).toContain('content_fr');
      expect(multiMatch.multi_match.fuzziness).toBe('AUTO');
    });

    it('should sort by score then date when query is provided', async () => {
      mockOsClient.indices.exists.mockResolvedValue({ body: true });
      mockOsClient.search.mockResolvedValue(makeOsSearchResponse());

      await service.search({ q: 'disease' });

      const searchCall = mockOsClient.search.mock.calls[0][0];
      expect(searchCall.body.sort).toEqual([{ _score: 'desc' }, { publishedAt: 'desc' }]);
    });

    it('should apply Postgres fallback filters for categoryId and type', async () => {
      mockOsClient.indices.exists.mockRejectedValue(new Error('ECONNREFUSED'));

      vi.spyOn(console, 'warn').mockImplementation(() => {});

      prisma.knowledgePublication.findMany.mockResolvedValue([]);
      prisma.knowledgePublication.count.mockResolvedValue(0);

      await service.search({ categoryId: 'cat-1', type: 'REPORT' });

      const findManyCall = prisma.knowledgePublication.findMany.mock.calls[0][0];
      expect(findManyCall.where.categoryId).toBe('cat-1');
      expect(findManyCall.where.type).toBe('REPORT');
      expect(findManyCall.where.status).toBe('PUBLISHED');
      expect(findManyCall.where.visibility).toBe('PUBLIC');

      vi.restoreAllMocks();
    });

    it('should apply Postgres fallback OR clause for text query', async () => {
      mockOsClient.indices.exists.mockRejectedValue(new Error('ECONNREFUSED'));

      vi.spyOn(console, 'warn').mockImplementation(() => {});

      prisma.knowledgePublication.findMany.mockResolvedValue([]);
      prisma.knowledgePublication.count.mockResolvedValue(0);

      await service.search({ q: 'health' });

      const findManyCall = prisma.knowledgePublication.findMany.mock.calls[0][0];
      expect(findManyCall.where.OR).toEqual([
        { tags: { has: 'health' } },
        { authors: { has: 'health' } },
      ]);

      vi.restoreAllMocks();
    });
  });
});

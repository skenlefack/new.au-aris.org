// OpenSearch indexing & search for the Knowledge Hub.
//
// One index `aris-knowledge` stores PUBLISHED publications. Each document
// includes the multilingual title, summary, and (HTML-stripped) content as
// language subfields, allowing the right analyzer to be used per locale.
//
// Indexing is best-effort: failures are logged but never break the API
// transaction. Reads (search) are also resilient: if OpenSearch is down or
// the index does not yet exist, the service falls back to a Postgres ILIKE
// scan so the public portal stays functional.

import { Client } from '@opensearch-project/opensearch';
import type { PrismaClient } from '@prisma/client';

const INDEX_NAME = 'aris-knowledge';

export interface SearchHit {
  id: string;
  slug: string;
  title: Record<string, string>;
  summary: Record<string, string> | null;
  type: string;
  categoryId: string;
  categorySlug: string | null;
  scope: string;
  scopeTenantId: string | null;
  publishedAt: string | null;
  tags: string[];
  authors: string[];
  visibility: string;
  highlight?: string;
}

export interface SearchResponse {
  total: number;
  page: number;
  limit: number;
  hits: SearchHit[];
  facets: {
    categories: { id: string; count: number }[];
    types: { value: string; count: number }[];
    scopes: { value: string; count: number }[];
  };
}

export class SearchService {
  private readonly client: Client;
  private indexReady = false;

  constructor(private readonly prisma: PrismaClient) {
    this.client = new Client({
      node: process.env['OPENSEARCH_URL'] ?? 'http://localhost:9200',
      ssl: { rejectUnauthorized: process.env['NODE_ENV'] === 'production' },
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Index lifecycle
  // ─────────────────────────────────────────────────────────────

  async ensureIndex(): Promise<void> {
    if (this.indexReady) return;
    try {
      const exists = await this.client.indices.exists({ index: INDEX_NAME });
      if (!exists.body) {
        await this.client.indices.create({
          index: INDEX_NAME,
          body: {
            settings: {
              analysis: {
                analyzer: {
                  ar_analyzer: { type: 'arabic' as any },
                },
              },
            },
            mappings: {
              properties: {
                tenantId:        { type: 'keyword' },
                categoryId:      { type: 'keyword' },
                categorySlug:    { type: 'keyword' },
                slug:            { type: 'keyword' },
                type:            { type: 'keyword' },
                status:          { type: 'keyword' },
                visibility:      { type: 'keyword' },
                scope:           { type: 'keyword' },
                scopeTenantId:   { type: 'keyword' },
                tags:            { type: 'keyword' },
                authors:         { type: 'keyword' },
                publishedAt:     { type: 'date' },
                // Multilingual fields — analyzer per language
                title_en:        { type: 'text', analyzer: 'english' },
                title_fr:        { type: 'text', analyzer: 'french' },
                title_pt:        { type: 'text', analyzer: 'portuguese' },
                title_ar:        { type: 'text', analyzer: 'arabic' },
                summary_en:      { type: 'text', analyzer: 'english' },
                summary_fr:      { type: 'text', analyzer: 'french' },
                summary_pt:      { type: 'text', analyzer: 'portuguese' },
                summary_ar:      { type: 'text', analyzer: 'arabic' },
                content_en:      { type: 'text', analyzer: 'english' },
                content_fr:      { type: 'text', analyzer: 'french' },
                content_pt:      { type: 'text', analyzer: 'portuguese' },
                content_ar:      { type: 'text', analyzer: 'arabic' },
                // Full multilingual blob for cross-language fallback
                title:           { type: 'object', enabled: false },
                summary:         { type: 'object', enabled: false },
              },
            },
          } as any,
        });
        console.log(`[SearchService] Created OpenSearch index ${INDEX_NAME}`);
      }
      this.indexReady = true;
    } catch (err) {
      console.warn(`[SearchService] OpenSearch unavailable, search will fall back to Postgres: ${err instanceof Error ? err.message : err}`);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Indexing
  // ─────────────────────────────────────────────────────────────

  async index(publication: any): Promise<void> {
    try {
      await this.ensureIndex();
      if (!this.indexReady) return;

      const title = publication.title ?? {};
      const summary = publication.summary ?? {};
      const content = publication.contentText ?? {};

      await this.client.index({
        index: INDEX_NAME,
        id: publication.id,
        body: {
          tenantId: publication.tenantId,
          categoryId: publication.categoryId,
          categorySlug: publication.category?.slug ?? null,
          slug: publication.slug,
          type: publication.type,
          status: publication.status,
          visibility: publication.visibility,
          scope: publication.category?.scope ?? null,
          scopeTenantId: publication.category?.scopeTenantId ?? null,
          tags: publication.tags ?? [],
          authors: publication.authors ?? [],
          publishedAt: publication.publishedAt,
          title,
          summary,
          title_en: title.en ?? null,
          title_fr: title.fr ?? null,
          title_pt: title.pt ?? null,
          title_ar: title.ar ?? null,
          summary_en: summary.en ?? null,
          summary_fr: summary.fr ?? null,
          summary_pt: summary.pt ?? null,
          summary_ar: summary.ar ?? null,
          content_en: content.en ?? null,
          content_fr: content.fr ?? null,
          content_pt: content.pt ?? null,
          content_ar: content.ar ?? null,
        },
        refresh: 'wait_for',
      });
    } catch (err) {
      console.warn(`[SearchService] Failed to index publication ${publication.id}: ${err instanceof Error ? err.message : err}`);
    }
  }

  async remove(publicationId: string): Promise<void> {
    try {
      await this.ensureIndex();
      if (!this.indexReady) return;
      await this.client.delete({ index: INDEX_NAME, id: publicationId, refresh: 'wait_for' });
    } catch {
      // Best-effort
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Search (public)
  // ─────────────────────────────────────────────────────────────

  async search(opts: {
    q?: string;
    page?: number;
    limit?: number;
    categoryId?: string;
    type?: string;
    scope?: string;
    scopeTenantId?: string;
    lang?: string;
  }): Promise<SearchResponse> {
    const page = opts.page ?? 1;
    const limit = Math.min(opts.limit ?? 12, 50);
    const from = (page - 1) * limit;

    try {
      await this.ensureIndex();
      if (!this.indexReady) return this.fallbackPostgresSearch(opts, page, limit);

      const must: any[] = [
        { term: { status: 'PUBLISHED' } },
        { term: { visibility: 'PUBLIC' } },
      ];

      if (opts.q && opts.q.trim()) {
        const lang = (opts.lang ?? 'en').toLowerCase();
        const fields = [
          `title_${lang}^4`, `summary_${lang}^2`, `content_${lang}`,
          'title_en^2', 'title_fr^2', 'title_pt^2', 'title_ar^2',
          'tags^3', 'authors^2',
        ];
        must.push({
          multi_match: {
            query: opts.q,
            fields,
            type: 'best_fields',
            fuzziness: 'AUTO',
          },
        });
      }

      const filters: any[] = [];
      if (opts.categoryId) filters.push({ term: { categoryId: opts.categoryId } });
      if (opts.type) filters.push({ term: { type: opts.type } });
      if (opts.scope) filters.push({ term: { scope: opts.scope } });
      if (opts.scopeTenantId) filters.push({ term: { scopeTenantId: opts.scopeTenantId } });

      const result = await this.client.search({
        index: INDEX_NAME,
        body: {
          from,
          size: limit,
          query: { bool: { must, filter: filters } },
          sort: opts.q ? [{ _score: 'desc' }, { publishedAt: 'desc' }] : [{ publishedAt: 'desc' }],
          highlight: opts.q
            ? {
                fields: {
                  content_en: { fragment_size: 200, number_of_fragments: 1 },
                  content_fr: { fragment_size: 200, number_of_fragments: 1 },
                  content_pt: { fragment_size: 200, number_of_fragments: 1 },
                  content_ar: { fragment_size: 200, number_of_fragments: 1 },
                },
              }
            : undefined,
          aggs: {
            categories: { terms: { field: 'categoryId', size: 30 } },
            types:      { terms: { field: 'type', size: 20 } },
            scopes:     { terms: { field: 'scope', size: 5 } },
          },
        } as any,
      });

      const body: any = result.body;
      const hits: SearchHit[] = (body.hits?.hits ?? []).map((h: any) => ({
        id: h._id,
        slug: h._source.slug,
        title: h._source.title ?? {},
        summary: h._source.summary ?? null,
        type: h._source.type,
        categoryId: h._source.categoryId,
        categorySlug: h._source.categorySlug,
        scope: h._source.scope,
        scopeTenantId: h._source.scopeTenantId,
        publishedAt: h._source.publishedAt,
        tags: h._source.tags ?? [],
        authors: h._source.authors ?? [],
        visibility: h._source.visibility,
        highlight: h.highlight ? Object.values(h.highlight).flat().join(' … ') : undefined,
      }));

      return {
        total: typeof body.hits?.total === 'object' ? body.hits.total.value : body.hits?.total ?? 0,
        page,
        limit,
        hits,
        facets: {
          categories: (body.aggregations?.categories?.buckets ?? []).map((b: any) => ({ id: b.key, count: b.doc_count })),
          types:      (body.aggregations?.types?.buckets ?? []).map((b: any) => ({ value: b.key, count: b.doc_count })),
          scopes:     (body.aggregations?.scopes?.buckets ?? []).map((b: any) => ({ value: b.key, count: b.doc_count })),
        },
      };
    } catch (err) {
      console.warn(`[SearchService] OpenSearch query failed, using Postgres fallback: ${err instanceof Error ? err.message : err}`);
      return this.fallbackPostgresSearch(opts, page, limit);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Postgres fallback (no fuzzy/highlights, but functional)
  // ─────────────────────────────────────────────────────────────

  private async fallbackPostgresSearch(
    opts: { q?: string; categoryId?: string; type?: string; scope?: string; scopeTenantId?: string },
    page: number,
    limit: number,
  ): Promise<SearchResponse> {
    const where: any = { status: 'PUBLISHED', visibility: 'PUBLIC' };
    if (opts.categoryId) where.categoryId = opts.categoryId;
    if (opts.type) where.type = opts.type;
    if (opts.q) {
      where.OR = [
        { tags: { has: opts.q } },
        { authors: { has: opts.q } },
      ];
    }

    const [data, total] = await Promise.all([
      (this.prisma as any).knowledgePublication.findMany({
        where,
        include: { category: true },
        orderBy: { publishedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      (this.prisma as any).knowledgePublication.count({ where }),
    ]);

    return {
      total,
      page,
      limit,
      hits: data.map((p: any) => ({
        id: p.id,
        slug: p.slug,
        title: p.title ?? {},
        summary: p.summary ?? null,
        type: p.type,
        categoryId: p.categoryId,
        categorySlug: p.category?.slug ?? null,
        scope: p.category?.scope ?? null,
        scopeTenantId: p.category?.scopeTenantId ?? null,
        publishedAt: p.publishedAt,
        tags: p.tags ?? [],
        authors: p.authors ?? [],
        visibility: p.visibility,
      })),
      facets: { categories: [], types: [], scopes: [] },
    };
  }
}

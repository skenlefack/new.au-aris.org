import { randomUUID } from 'crypto';
import type { Client } from '@elastic/elasticsearch';
import type Redis from 'ioredis';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import type { KafkaHeaders } from '@aris/shared-types';

const SERVICE_NAME = 'datalake-service';
const CACHE_TTL_SECONDS = 120; // 2 minutes
const CACHE_PREFIX = 'aris:datalake:search:';

export class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export interface SearchDto {
  query: string;
  index?: string;
  from?: number;
  size?: number;
  filters?: Record<string, unknown>;
  sort?: Record<string, unknown>;
}

export interface ExportDto {
  index: string;
  format?: 'json' | 'csv';
  query?: string;
}

export class DatalakeService {
  constructor(
    private readonly elastic: Client,
    private readonly redis: Redis,
    private readonly kafka: StandaloneKafkaProducer,
  ) {}

  async search(dto: SearchDto): Promise<{ data: unknown[]; meta: { total: number; from: number; size: number } }> {
    const from = dto.from ?? 0;
    const size = dto.size ?? 20;

    // Build cache key from search parameters
    const cacheKey = CACHE_PREFIX + this.hashSearchParams(dto);
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const searchBody: Record<string, unknown> = {
      query: {
        bool: {
          must: [
            {
              query_string: {
                query: dto.query,
              },
            },
          ],
          filter: dto.filters ? this.buildFilters(dto.filters) : [],
        },
      },
      from,
      size,
    };

    if (dto.sort && Object.keys(dto.sort).length > 0) {
      searchBody['sort'] = dto.sort;
    }

    const indexTarget = dto.index ?? '*';

    const response = await this.elastic.search({
      index: indexTarget,
      body: searchBody,
    });

    const hits = Array.isArray(response.hits?.hits)
      ? response.hits.hits.map((hit: any) => ({
          _index: hit._index,
          _id: hit._id,
          _score: hit._score,
          ...hit._source,
        }))
      : [];

    const total = typeof response.hits?.total === 'object'
      ? (response.hits.total as any).value
      : response.hits?.total ?? 0;

    const result = {
      data: hits,
      meta: { total, from, size },
    };

    // Cache result with 2-minute TTL
    await this.redis.set(cacheKey, JSON.stringify(result), 'EX', CACHE_TTL_SECONDS);

    return result;
  }

  async listIndices(): Promise<{ data: unknown[] }> {
    const response = await this.elastic.cat.indices({
      format: 'json',
    });

    const indices = Array.isArray(response) ? response : [];

    return { data: indices };
  }

  async reindex(
    indexName: string,
    tenantId: string,
    userId: string,
  ): Promise<{ data: { taskId: string; message: string } }> {
    // Validate index exists
    const exists = await this.elastic.indices.exists({ index: indexName });
    if (!exists) {
      throw new HttpError(404, `Index '${indexName}' not found`);
    }

    const destIndex = `${indexName}_reindex_${Date.now()}`;

    const response = await this.elastic.reindex({
      wait_for_completion: false,
      body: {
        source: { index: indexName },
        dest: { index: destIndex },
      },
    });

    const taskId = response.task ? String(response.task) : 'unknown';

    // Publish reindex event to Kafka
    await this.publishEvent(
      'sys.datalake.index.reindexed.v1',
      indexName,
      { indexName, destIndex, taskId },
      tenantId,
      userId,
    );

    return {
      data: {
        taskId,
        message: `Reindex task started for '${indexName}' → '${destIndex}'`,
      },
    };
  }

  async exportData(dto: ExportDto): Promise<{ data: unknown[]; meta: { total: number; format: string } }> {
    const searchBody: Record<string, unknown> = {};

    if (dto.query) {
      searchBody['query'] = {
        query_string: {
          query: dto.query,
        },
      };
    } else {
      searchBody['query'] = { match_all: {} };
    }

    // Use search with a larger size for export (up to 10000)
    const response = await this.elastic.search({
      index: dto.index,
      body: {
        ...searchBody,
        size: 10000,
      },
    });

    const hits = Array.isArray(response.hits?.hits)
      ? response.hits.hits.map((hit: any) => ({
          _index: hit._index,
          _id: hit._id,
          ...hit._source,
        }))
      : [];

    const total = typeof response.hits?.total === 'object'
      ? (response.hits.total as any).value
      : response.hits?.total ?? 0;

    const format = dto.format ?? 'json';

    return {
      data: hits,
      meta: { total, format },
    };
  }

  private buildFilters(filters: Record<string, unknown>): unknown[] {
    const clauses: unknown[] = [];
    for (const [field, value] of Object.entries(filters)) {
      if (Array.isArray(value)) {
        clauses.push({ terms: { [field]: value } });
      } else {
        clauses.push({ term: { [field]: value } });
      }
    }
    return clauses;
  }

  private hashSearchParams(dto: SearchDto): string {
    const raw = JSON.stringify({
      q: dto.query,
      i: dto.index,
      f: dto.from,
      s: dto.size,
      fl: dto.filters,
      so: dto.sort,
    });
    // Simple hash for cache key
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      const chr = raw.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private async publishEvent(
    topic: string,
    entityId: string,
    payload: unknown,
    tenantId: string,
    userId: string,
  ): Promise<void> {
    const headers: KafkaHeaders = {
      correlationId: randomUUID(),
      sourceService: SERVICE_NAME,
      tenantId,
      userId,
      schemaVersion: '1',
      timestamp: new Date().toISOString(),
    };
    try {
      await this.kafka.send(topic, entityId, payload, headers);
    } catch {}
  }
}

import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type { Client } from '@opensearch-project/opensearch';
import type Redis from 'ioredis';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import type { KafkaHeaders } from '@aris/shared-types';

const SERVICE_NAME = 'datalake-service';

/** Map topic domain segment to Prisma DatalakeSource enum value */
const DOMAIN_TO_SOURCE: Record<string, string> = {
  health: 'HEALTH',
  livestock: 'LIVESTOCK',
  fisheries: 'FISHERIES',
  wildlife: 'WILDLIFE',
  apiculture: 'APICULTURE',
  trade: 'TRADE',
  governance: 'GOVERNANCE',
  climate: 'CLIMATE',
  collecte: 'COLLECTE',
  workflow: 'WORKFLOW',
  quality: 'QUALITY',
  interop: 'INTEROP',
  master: 'MASTER',
  credential: 'CREDENTIAL',
  message: 'MESSAGE',
  realtime: 'REALTIME',
  support: 'SUPPORT',
  formbuilder: 'COLLECTE',
  datalake: 'UNKNOWN',
};

interface ParsedTopic {
  scope: string;
  domain: string;
  entityType: string;
  action: string;
  version: string;
}

export class IngestionService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly elastic: Client,
    private readonly redis: Redis,
    private readonly kafka: StandaloneKafkaProducer,
  ) {}

  /**
   * Ingest a domain event from Kafka into the datalake.
   */
  async ingest(
    topic: string,
    payload: unknown,
    headers: Record<string, string | undefined>,
  ): Promise<void> {
    const parsed = this.parseTopic(topic);
    const source = DOMAIN_TO_SOURCE[parsed.domain] ?? 'UNKNOWN';
    const data = (payload && typeof payload === 'object') ? payload as Record<string, unknown> : {};

    const tenantId = headers['tenantId'] ?? (data['tenantId'] as string) ?? '00000000-0000-0000-0000-000000000000';
    const entityId = (data['id'] as string) ?? (data['entityId'] as string) ?? randomUUID();
    const action = parsed.action;

    // Resolve country/rec codes
    const countryCode = await this.resolveCountryCode(data, tenantId);
    const recCode = (data['recCode'] as string) ?? (data['rec_code'] as string) ?? null;

    // Extract geo point
    const geoPoint = this.extractGeoPoint(data);

    // Compute temporal fields from current time
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const week = this.getISOWeek(now);

    // 1. Insert into Prisma
    const entry = await this.prisma.dataLakeEntry.create({
      data: {
        source: source as any,
        entity_type: `${parsed.domain}.${parsed.entityType}`,
        entity_id: entityId,
        action,
        payload: data as any,
        metadata: {
          topic,
          correlationId: headers['correlationId'],
          sourceService: headers['sourceService'],
          schemaVersion: parsed.version,
        } as any,
        tenant_id: tenantId,
        country_code: countryCode,
        rec_code: recCode,
        geo_point: geoPoint as any,
        year,
        month,
        week,
      },
    });

    // 2. Index into OpenSearch
    try {
      await this.elastic.index({
        index: `aris-datalake-${parsed.domain}`,
        id: entry.id,
        body: {
          source,
          entity_type: `${parsed.domain}.${parsed.entityType}`,
          entity_id: entityId,
          action,
          tenant_id: tenantId,
          country_code: countryCode,
          rec_code: recCode,
          geo_point: geoPoint,
          year,
          month,
          week,
          ingested_at: entry.ingested_at,
          payload: data,
        },
      });
    } catch (err) {
      // OpenSearch indexing is non-critical
      console.error(`[IngestionService] OpenSearch index failed: ${err}`);
    }

    // 3. Publish ingestion event (non-blocking)
    this.publishEvent(entry.id, {
      entryId: entry.id,
      source,
      entityType: `${parsed.domain}.${parsed.entityType}`,
      action,
      tenantId,
    }).catch(() => {});
  }

  /**
   * Parse a Kafka topic string into its components.
   * Format: {scope}.{domain}.{entity}.{action}.v{version}
   */
  parseTopic(topic: string): ParsedTopic {
    const parts = topic.split('.');
    // Minimum: scope.domain.entity.action.version
    if (parts.length < 5) {
      return {
        scope: parts[0] ?? 'unknown',
        domain: parts[1] ?? 'unknown',
        entityType: parts[2] ?? 'unknown',
        action: parts[3] ?? 'unknown',
        version: parts[4] ?? 'v1',
      };
    }

    // Handle topics with extra segments like: ms.health.entity.flags-updated.v1
    const scope = parts[0]!;
    const domain = parts[1]!;
    const version = parts[parts.length - 1]!;
    const action = parts[parts.length - 2]!;
    const entityType = parts.slice(2, parts.length - 2).join('.');

    return { scope, domain, entityType, action, version };
  }

  /**
   * Extract geo point from various payload shapes.
   */
  extractGeoPoint(data: Record<string, unknown>): { lat: number; lng: number } | null {
    // Direct lat/lng
    if (typeof data['latitude'] === 'number' && typeof data['longitude'] === 'number') {
      return { lat: data['latitude'], lng: data['longitude'] };
    }

    // Nested location object
    const location = data['location'] as Record<string, unknown> | undefined;
    if (location && typeof location['lat'] === 'number' && typeof location['lng'] === 'number') {
      return { lat: location['lat'], lng: location['lng'] };
    }
    if (location && typeof location['latitude'] === 'number' && typeof location['longitude'] === 'number') {
      return { lat: location['latitude'], lng: location['longitude'] };
    }

    // geoPoint field
    const geoPoint = data['geoPoint'] as Record<string, unknown> | undefined;
    if (geoPoint && typeof geoPoint['lat'] === 'number' && typeof geoPoint['lng'] === 'number') {
      return { lat: geoPoint['lat'], lng: geoPoint['lng'] };
    }

    return null;
  }

  private async resolveCountryCode(
    data: Record<string, unknown>,
    tenantId: string,
  ): Promise<string | null> {
    // Try direct field
    const direct = (data['countryCode'] as string) ?? (data['country_code'] as string);
    if (direct) return direct;

    // Try Redis cache for tenant → country mapping
    try {
      const cached = await this.redis.get(`aris:tenant:country:${tenantId}`);
      if (cached) return cached;
    } catch {
      // Redis unavailable
    }

    return null;
  }

  private getISOWeek(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }

  private async publishEvent(entityId: string, payload: unknown): Promise<void> {
    const headers: KafkaHeaders = {
      correlationId: randomUUID(),
      sourceService: SERVICE_NAME,
      tenantId: 'system',
      schemaVersion: '1',
      timestamp: new Date().toISOString(),
    };
    await this.kafka.send('sys.datalake.entry.ingested.v1', entityId, payload, headers);
  }
}

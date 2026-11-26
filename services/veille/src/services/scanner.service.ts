import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type { FastifyBaseLogger } from 'fastify';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import { TOPIC_AU_VEILLE_SIGNAL_CREATED } from '@aris/shared-types';
import { fetchFeed, fetchGdelt, gdeltQuery, type FeedItem } from '../lib/feeds';
import {
  classifyCategory, classifySeverity, concernsAfrica, containsTerm, detectCountries, matchWatchList, normalize, priorityScore,
  relevanceScore, titleKey, urlHash, type RuleMatch, type WatchListRule,
} from '../lib/text';
import type { AiEnrichmentService } from './ai.service';

const SERVICE_NAME = 'veille-service';
const DUPLICATE_WINDOW_DAYS = 14;
const AI_MIN_PRIORITY = parseInt(process.env['VEILLE_AI_MIN_PRIORITY'] ?? '45', 10);

export interface RunResult {
  sourceId: string;
  fetched: number;
  created: number;
  duplicates: number;
  unmatched: number;
  error?: string;
}

interface Candidate {
  item: FeedItem;
  /** GDELT already matched the full article for this watchlist */
  queriedFor?: WatchListRule;
}

/** Scans due sources on a timer and turns matching items into signals. */
export class ScannerService {
  private timer: NodeJS.Timeout | null = null;
  private busy = false;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: StandaloneKafkaProducer,
    private readonly ai: AiEnrichmentService,
    private readonly log: FastifyBaseLogger,
  ) {}

  private get db(): any {
    return this.prisma as any;
  }

  start(intervalMs = 60_000): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.tick(), intervalMs);
    setTimeout(() => void this.tick(), 15_000);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async tick(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const sources = await this.db.watchSource.findMany({ where: { isActive: true } });
      const now = Date.now();
      const due = sources.filter((s: any) => !s.lastRunAt || now - new Date(s.lastRunAt).getTime() >= s.intervalMinutes * 60_000);
      for (const source of due) await this.runSource(source.id);
    } catch (err) {
      this.log.error(err, '[veille] scan cycle failed');
    } finally {
      this.busy = false;
    }
  }

  async runSource(sourceId: string): Promise<RunResult> {
    const source = await this.db.watchSource.findUnique({ where: { id: sourceId } });
    if (!source) throw Object.assign(new Error('Source not found'), { statusCode: 404 });
    const result: RunResult = { sourceId, fetched: 0, created: 0, duplicates: 0, unmatched: 0 };
    try {
      const rules: WatchListRule[] = await this.db.watchList.findMany({
        where: { isActive: true },
        select: { id: true, domain: true, anyTerms: true, allTerms: true, excludeTerms: true, countries: true, campaignId: true },
      });
      const candidates = await this.collect(source, rules);
      result.fetched = candidates.length;
      await this.ingest(source, rules, candidates, result);
      await this.db.watchSource.update({
        where: { id: sourceId },
        data: { lastRunAt: new Date(), lastStatus: 'ok', lastError: null, lastItemCount: result.created },
      });
    } catch (err) {
      result.error = (err as Error).message;
      this.log.warn(`[veille] source ${source.name}: ${result.error}`);
      await this.db.watchSource.update({
        where: { id: sourceId },
        data: { lastRunAt: new Date(), lastStatus: 'error', lastError: result.error.slice(0, 1000), lastItemCount: 0 },
      });
    }
    return result;
  }

  private async collect(source: any, rules: WatchListRule[]): Promise<Candidate[]> {
    if (source.type === 'RSS') return (await fetchFeed(source.url)).map((item) => ({ item }));
    // GDELT: one query per watchlist, over the window since the previous run
    const span = Math.min(7 * 24 * 60, Math.max(60, source.intervalMinutes * 2));
    const timespan = span >= 1440 ? `${Math.ceil(span / 1440)}d` : `${span}min`;
    const out: Candidate[] = [];
    for (const rule of rules) {
      const q = gdeltQuery(rule.anyTerms, rule.allTerms);
      if (!q) continue;
      const items = await fetchGdelt(source.url, q, timespan);
      out.push(...items.map((item) => ({ item, queriedFor: rule })));
      await new Promise((r) => setTimeout(r, 5_000)); // GDELT asks for one request every 5 s
    }
    return out;
  }

  private async ingest(source: any, rules: WatchListRule[], candidates: Candidate[], result: RunResult): Promise<void> {
    const hashes = [...new Set(candidates.map((c) => urlHash(c.item.url)))];
    const existing = new Set<string>(
      (await this.db.watchSignal.findMany({ where: { urlHash: { in: hashes } }, select: { urlHash: true } })).map((r: any) => r.urlHash),
    );
    const since = new Date(Date.now() - DUPLICATE_WINDOW_DAYS * 86_400_000);
    const seen = new Set<string>();

    for (const { item, queriedFor } of candidates) {
      const hash = urlHash(item.url);
      const tKey = titleKey(item.title);
      if (existing.has(hash) || seen.has(hash) || seen.has(tKey)) {
        result.duplicates++;
        continue;
      }
      seen.add(hash);
      seen.add(tKey);

      const normTitle = normalize(item.title);
      const normText = normalize(`${item.title} ${item.excerpt}`);
      const countries = [...new Set([
        ...detectCountries(normText),
        ...detectCountries(normalize(item.countryHint ?? '')),
        ...(source.countryCode ? [source.countryCode] : []),
      ])];

      // The watch covers the African continent: drop items that name neither Africa nor a Member State
      if (!concernsAfrica(normText, countries)) {
        result.unmatched++;
        continue;
      }

      const matches: RuleMatch[] = rules.map((r) => matchWatchList(r, normText, countries)).filter((m): m is RuleMatch => !!m);
      if (queriedFor && !matches.some((m) => m.watchListId === queriedFor.id)) {
        // GDELT matched the article body; keep it unless the title hits an exclusion or the country filter
        const blocked = queriedFor.excludeTerms.some((t) => containsTerm(normText, t));
        const outOfScope = queriedFor.countries.length > 0 && !countries.some((c) => queriedFor.countries.includes(c));
        if (!blocked && !outOfScope) matches.push({ watchListId: queriedFor.id, domain: queriedFor.domain, matchedTerms: [] });
      }
      if (matches.length === 0) {
        result.unmatched++;
        continue;
      }

      if (await this.db.watchSignal.findFirst({ where: { titleKey: tKey, collectedAt: { gte: since } }, select: { id: true } })) {
        result.duplicates++;
        continue;
      }

      const matchedTerms = [...new Set(matches.flatMap((m) => m.matchedTerms))];
      const domain = this.mainDomain(matches);
      const severity = classifySeverity(normText);
      const relevance = relevanceScore(matchedTerms, normTitle, matches.length);
      const priority = priorityScore(relevance, severity, source.reliability, item.publishedAt);
      const campaignIds = [...new Set(matches.map((m) => (rules.find((r) => r.id === m.watchListId) as any)?.campaignId).filter(Boolean))];

      const signal = await this.db.watchSignal.create({
        data: {
          sourceId: source.id,
          urlHash: hash,
          titleKey: tKey,
          url: item.url,
          title: item.title.slice(0, 2000),
          excerpt: item.excerpt || null,
          language: item.language ?? source.language ?? null,
          publishedAt: item.publishedAt,
          watchListIds: matches.map((m) => m.watchListId),
          domain,
          category: classifyCategory(normText),
          countries,
          matchedTerms,
          relevance,
          severity,
          priority,
          reliability: source.reliability,
          campaignId: campaignIds.length === 1 ? campaignIds[0] : null,
        },
      });
      result.created++;
      void this.publish(signal);
      if (priority >= AI_MIN_PRIORITY) this.ai.enqueue(signal.id);
    }
  }

  /** Domain of the watchlists that matched most often (ties: first watchlist). */
  private mainDomain(matches: RuleMatch[]): string {
    const counts = new Map<string, number>();
    for (const m of matches) counts.set(m.domain, (counts.get(m.domain) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }

  private async publish(signal: any): Promise<void> {
    const send = this.kafka.send(TOPIC_AU_VEILLE_SIGNAL_CREATED, signal.id, {
      id: signal.id, domain: signal.domain, category: signal.category, countries: signal.countries,
      severity: signal.severity, priority: signal.priority, url: signal.url, title: signal.title,
    }, {
      correlationId: randomUUID(), sourceService: SERVICE_NAME, tenantId: '00000000-0000-4000-a000-000000000001',
      schemaVersion: '1', timestamp: new Date().toISOString(),
    });
    try {
      await Promise.race([send, new Promise((_, rej) => setTimeout(() => rej(new Error('Kafka publish timeout')), 5_000))]);
    } catch (err) {
      this.log.debug(`[veille] publish skipped: ${(err as Error).message}`);
    }
  }
}

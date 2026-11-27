import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type { FastifyBaseLogger } from 'fastify';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import { TOPIC_AU_VEILLE_SIGNAL_CREATED } from '@aris/shared-types';
import { fetchFeed, fetchGdelt, gdeltQueries, type FeedItem } from '../lib/feeds';
import {
  classifyCategory, classifySeverity, concernsAfrica, containsTerm, corroborationBonus, countryText, detectCountries, findClusterLead,
  matchWatchList, normalize, priorityScore, relevanceScore, titleKey, titleTokens, urlHash, type ClusterEntry, type RuleMatch,
  type WatchListRule,
} from '../lib/text';
import type { AiEnrichmentService } from './ai.service';

const SERVICE_NAME = 'veille-service';
const DUPLICATE_WINDOW_DAYS = 14;
const ARIS_LANGUAGES = new Set(['en', 'fr', 'pt', 'ar', 'es', 'sw']);
const AI_MIN_PRIORITY = parseInt(process.env['VEILLE_AI_MIN_PRIORITY'] ?? '45', 10);

export interface RunResult {
  sourceId: string;
  fetched: number;
  created: number;
  /** articles attached to an existing story (another outlet reporting it) */
  grouped: number;
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
    const result: RunResult = { sourceId, fetched: 0, created: 0, grouped: 0, duplicates: 0, unmatched: 0 };
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
        data: { lastRunAt: new Date(), lastStatus: 'ok', lastError: null, lastItemCount: result.created + result.grouped },
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
    // GDELT: one query per watchlist. GDELT covers the world press and few items concern Africa,
    // so look back at least 3 days with the maximum page size; URL de-duplication drops repeats.
    const days = Math.min(7, Math.max(3, Math.ceil((source.intervalMinutes * 2) / 1440)));
    const timespan = `${days}d`;
    const out: Candidate[] = [];
    const errors: string[] = [];
    let queried = 0;
    for (const rule of rules) {
      for (const q of gdeltQueries(rule.anyTerms, rule.allTerms)) {
        queried++;
        try {
          const items = await fetchGdelt(source.url, q, timespan, 250);
          out.push(...items.map((item) => ({ item, queriedFor: rule })));
        } catch (err) {
          // one failing query must not lose the others
          errors.push((err as Error).message);
        }
        await new Promise((r) => setTimeout(r, 12_000)); // GDELT asks for one request every 5 s; the AU egress IP is shared
      }
    }
    if (queried > 0 && errors.length === queried) throw new Error(errors[0]);
    if (errors.length > 0) this.log.warn(`[veille] ${source.name}: ${errors.length}/${queried} GDELT queries failed (${errors[0]})`);
    return out;
  }

  private async ingest(source: any, rules: WatchListRule[], candidates: Candidate[], result: RunResult): Promise<void> {
    const hashes = [...new Set(candidates.map((c) => urlHash(c.item.url)))];
    const existing = new Set<string>(
      (await this.db.watchSignal.findMany({ where: { urlHash: { in: hashes } }, select: { urlHash: true } })).map((r: any) => r.urlHash),
    );
    const since = new Date(Date.now() - DUPLICATE_WINDOW_DAYS * 86_400_000);
    const seen = new Set<string>();
    // Recent stories new articles can join; filled lazily, then grows with this run's signals
    let pool: ClusterEntry[] | null = null;

    for (const { item, queriedFor } of candidates) {
      const hash = urlHash(item.url);
      if (existing.has(hash) || seen.has(hash)) {
        result.duplicates++;
        continue;
      }
      seen.add(hash);
      const tKey = titleKey(item.title);

      const normTitle = normalize(item.title);
      const normText = normalize(`${item.title} ${item.excerpt}`);
      // Countries named in the item (without the outlet's byline); GDELT's source country is the outlet's,
      // not the event's, so it only tells whether the item comes from the African press.
      const countries = [...new Set([...detectCountries(countryText(item.title, item.excerpt)), ...(source.countryCode ? [source.countryCode] : [])])];
      const africanOutlet = detectCountries(normalize(item.countryHint ?? '')).length > 0;

      // The watch covers the African continent: drop items that name neither Africa nor a Member State
      if (!concernsAfrica(normText, countries) && !africanOutlet) {
        result.unmatched++;
        continue;
      }

      const matches: RuleMatch[] = rules.map((r) => matchWatchList(r, normText, countries)).filter((m): m is RuleMatch => !!m);
      if (queriedFor && !matches.some((m) => m.watchListId === queriedFor.id) && ARIS_LANGUAGES.has(item.language ?? '')) {
        // GDELT matched the article body (in an ARIS language); keep it unless the title hits an exclusion or the country filter
        // without a term in the title, the text itself must name Africa or a Member State
        const blocked = queriedFor.excludeTerms.some((t) => containsTerm(normText, t)) || !concernsAfrica(normText, countries);
        const outOfScope = queriedFor.countries.length > 0 && !countries.some((c) => queriedFor.countries.includes(c));
        if (!blocked && !outOfScope) matches.push({ watchListId: queriedFor.id, domain: queriedFor.domain, matchedTerms: [] });
      }
      if (matches.length === 0) {
        result.unmatched++;
        continue;
      }

      pool ??= await this.clusterPool(since);
      const tokens = titleTokens(item.title);
      const leadId = findClusterLead(pool, tKey, tokens);

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
          clusterId: leadId,
        },
      });
      pool.push({ id: signal.id, leadId: leadId ?? signal.id, titleKey: tKey, tokens });
      if (leadId) {
        // Another outlet tells the same story: the lead gains a source and a corroboration bonus, no new alert
        await this.attachToLead(leadId);
        result.grouped++;
        continue;
      }
      result.created++;
      void this.publish(signal);
      if (priority >= AI_MIN_PRIORITY) this.ai.enqueue(signal.id);
    }
  }

  /** Signals collected in the duplicate window, as fingerprints pointing at the lead of their group. */
  private async clusterPool(since: Date): Promise<ClusterEntry[]> {
    const rows = await this.db.watchSignal.findMany({
      where: { collectedAt: { gte: since } },
      select: { id: true, clusterId: true, titleKey: true, title: true },
      orderBy: { collectedAt: 'asc' },
    });
    return rows.map((r: any) => ({ id: r.id, leadId: r.clusterId ?? r.id, titleKey: r.titleKey, tokens: titleTokens(r.title) }));
  }

  private async attachToLead(leadId: string): Promise<void> {
    // atomic increment: a manual run can ingest while the scheduled cycle does
    const lead = await this.db.watchSignal.update({ where: { id: leadId }, data: { clusterSize: { increment: 1 } }, select: { clusterSize: true, priority: true } });
    const bonus = corroborationBonus(lead.clusterSize) - corroborationBonus(lead.clusterSize - 1);
    if (bonus > 0 && lead.priority < 100) {
      await this.db.watchSignal.update({ where: { id: leadId }, data: { priority: Math.min(100, lead.priority + bonus) } });
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

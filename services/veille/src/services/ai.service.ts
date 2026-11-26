import type { PrismaClient } from '@prisma/client';
import type { FastifyBaseLogger } from 'fastify';

const DOMAINS = ['animal-health', 'livestock-prod', 'trade-sps', 'fisheries', 'governance', 'wildlife', 'apiculture', 'climate-env', 'knowledge-hub'];
const CATEGORIES = ['outbreak', 'trade', 'market', 'policy', 'climate', 'wildlife', 'production', 'other'];

export interface AiVerdict {
  relevant: boolean;
  domain: string;
  category: string;
  severity: number;
  summary_en: string;
  summary_fr: string;
  model: string;
}

/**
 * Enriches high-priority signals with a local LLM (Ollama on VM-AI): structured summary and a second
 * opinion on domain, category and severity. The VM has no GPU, so work is queued and capped per cycle;
 * keyword classification stays the source of truth when the model is unavailable.
 */
export class AiEnrichmentService {
  private readonly queue: string[] = [];
  private running = false;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly log: FastifyBaseLogger,
    private readonly url = process.env['OLLAMA_URL'] ?? '',
    private readonly model = process.env['VEILLE_AI_MODEL'] ?? 'qwen2.5:32b',
    private readonly enabled = process.env['VEILLE_AI_ENABLED'] === '1',
    private readonly timeoutMs = parseInt(process.env['VEILLE_AI_TIMEOUT_MS'] ?? '180000', 10),
  ) {}

  get isEnabled(): boolean {
    return this.enabled && !!this.url;
  }

  enqueue(signalId: string): void {
    if (!this.isEnabled || this.queue.includes(signalId) || this.queue.length >= 500) return;
    this.queue.push(signalId);
    void this.drain();
  }

  private async drain(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      while (this.queue.length > 0) {
        const id = this.queue.shift()!;
        try {
          await this.enrich(id);
        } catch (err) {
          this.log.warn(`[veille-ai] signal ${id}: ${(err as Error).message}`);
        }
      }
    } finally {
      this.running = false;
    }
  }

  async enrich(signalId: string): Promise<void> {
    const s = await (this.prisma as any).watchSignal.findUnique({ where: { id: signalId } });
    if (!s || s.aiClassification) return;
    const verdict = await this.ask(s.title, s.excerpt ?? '');
    await (this.prisma as any).watchSignal.update({
      where: { id: signalId },
      data: { aiSummary: verdict.summary_en || null, aiClassification: verdict },
    });
  }

  async ask(title: string, excerpt: string): Promise<AiVerdict> {
    const prompt = [
      'You classify news for ARIS, the African Union animal resources information system.',
      `Domains: ${DOMAINS.join(', ')}. Categories: ${CATEGORIES.join(', ')}.`,
      'Severity: 1 = information, 2 = to watch, 3 = alert (outbreak, deaths, trade ban, emergency).',
      'Answer only JSON: {"relevant": boolean, "domain": string, "category": string, "severity": 1|2|3, "summary_en": string, "summary_fr": string}.',
      'Summaries: at most two factual sentences, no speculation.',
      '',
      `Title: ${title}`,
      `Text: ${excerpt.slice(0, 1500)}`,
    ].join('\n');
    const res = await fetch(`${this.url.replace(/\/$/, '')}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, prompt, stream: false, format: 'json', options: { temperature: 0 } }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
    const body = (await res.json()) as { response?: string };
    const raw = JSON.parse(body.response ?? '{}') as Partial<AiVerdict>;
    return {
      relevant: raw.relevant !== false,
      domain: DOMAINS.includes(raw.domain ?? '') ? raw.domain! : 'other',
      category: CATEGORIES.includes(raw.category ?? '') ? raw.category! : 'other',
      severity: [1, 2, 3].includes(Number(raw.severity)) ? Number(raw.severity) : 1,
      summary_en: String(raw.summary_en ?? '').slice(0, 600),
      summary_fr: String(raw.summary_fr ?? '').slice(0, 600),
      model: this.model,
    };
  }
}

import type { PrismaClient } from '@prisma/client';
import {
  parseRule, matchCandidates, adminLeaf, clusterDuplicates, stableJson,
  type DuplicateRule, type CandidateRow,
} from './duplicate-rules';

/** How many probable duplicates are returned to the person submitting. */
const MAX_CANDIDATES = 5;
/** Safety cap on rows compared in memory for one check. */
const MAX_SCAN = 5000;

export type DuplicateStatus = 'SUSPECTED' | 'JUSTIFIED' | 'DISTINCT';

export interface DuplicateCandidate {
  id: string;
  submittedAt: string;
  submittedBy: string;
  submittedByName: string | null;
  status: string;
}

export interface DuplicateCheck {
  exact: DuplicateCandidate | null;
  rule: DuplicateRule | null;
  candidates: DuplicateCandidate[];
}

/** Stored on the submission when it was saved despite a duplicate warning. */
export interface DuplicateInfo {
  kind: 'exact' | 'rule';
  candidateIds: string[];
  reason?: string;
  source: 'web' | 'import' | 'sync';
  checkedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewReason?: string;
}

export class DuplicateService {
  private ruleCache = new Map<string, { rule: DuplicateRule | null; at: number }>();

  constructor(private readonly prisma: PrismaClient) {}

  /** Active rule of a template (cached 60 s; templates rarely change during collection). */
  async ruleFor(templateId: string | null | undefined): Promise<DuplicateRule | null> {
    if (!templateId) return null;
    const hit = this.ruleCache.get(templateId);
    if (hit && Date.now() - hit.at < 60_000) return hit.rule;
    let rule: DuplicateRule | null = null;
    try {
      const t = await (this.prisma as any).formTemplate.findUnique({ where: { id: templateId }, select: { schema: true } });
      rule = parseRule(t?.schema);
    } catch {
      rule = null;
    }
    this.ruleCache.set(templateId, { rule, at: Date.now() });
    return rule;
  }

  /** Same collector, same campaign, identical answers (key order ignored by jsonb equality). */
  async findExact(campaignId: string, submittedBy: string, data: Record<string, unknown>, excludeId?: string): Promise<DuplicateCandidate | null> {
    const rows: any[] = await (this.prisma as any).$queryRawUnsafe(
      `SELECT id, submitted_at, submitted_by, status::text AS status FROM public.submissions
        WHERE campaign_id = $1::uuid AND submitted_by = $2::uuid AND data = $3::jsonb
          AND ($4::uuid IS NULL OR id <> $4::uuid) AND status::text <> 'REJECTED'
        ORDER BY submitted_at ASC LIMIT 1`,
      campaignId, submittedBy, JSON.stringify(data), excludeId ?? null,
    ).catch(() => []);
    if (!rows.length) return null;
    const names = await this.names([rows[0].submitted_by]);
    return this.toCandidate(rows[0], names);
  }

  /** Probable duplicates under the template rule, in the same campaign. */
  async findCandidates(
    rule: DuplicateRule,
    campaignId: string,
    submittedBy: string,
    data: Record<string, unknown>,
    excludeId?: string,
  ): Promise<DuplicateCandidate[]> {
    // Narrow the scan with the location when the rule has one (the deepest level must match anyway).
    const params: unknown[] = [campaignId];
    let where = `campaign_id = $1::uuid AND status::text <> 'REJECTED'`;
    const admin = rule.fields.find((f) => f.kind === 'admin');
    const leaf = admin ? adminLeaf(data[admin.code]) : null;
    if (admin && leaf?.level) {
      params.push(admin.code, leaf.level, leaf.id);
      where += ` AND data -> $2::text ->> $3::text = $4::text`;
    }
    if (rule.sameCollectorOnly) {
      params.push(submittedBy);
      where += ` AND submitted_by = $${params.length}::uuid`;
    }
    const rows: any[] = await (this.prisma as any).$queryRawUnsafe(
      `SELECT id, data, submitted_at, submitted_by, status::text AS status FROM public.submissions
        WHERE ${where} ORDER BY submitted_at DESC LIMIT ${MAX_SCAN}`,
      ...params,
    ).catch(() => []);
    const matches = matchCandidates(
      rule, data,
      rows.map((r) => ({ id: r.id, data: r.data ?? {}, submittedBy: r.submitted_by, submittedAt: r.submitted_at })),
      { excludeId, submittedBy },
    ).slice(0, MAX_CANDIDATES);
    if (!matches.length) return [];
    const byId = new Map(rows.map((r) => [r.id, r]));
    const names = await this.names(matches.map((m) => m.submittedBy));
    return matches.map((m) => this.toCandidate(byId.get(m.id), names));
  }

  /** Full check used before saving: exact copy first, then the template rule. */
  async check(campaignId: string, templateId: string | null, submittedBy: string, data: Record<string, unknown>, excludeId?: string): Promise<DuplicateCheck> {
    const exact = await this.findExact(campaignId, submittedBy, data, excludeId);
    const rule = await this.ruleFor(templateId);
    const candidates = rule && !exact ? await this.findCandidates(rule, campaignId, submittedBy, data, excludeId) : [];
    return { exact, rule, candidates };
  }

  /**
   * Read-only review of a whole campaign: exact copies by the same collector and clusters of probable
   * duplicates under the template rule. Nothing is changed in the data.
   */
  async campaignGroups(rows: (CandidateRow & { status: string; tenantId: string; duplicateStatus?: string | null })[], templateRule: DuplicateRule | null) {
    const exactMap = new Map<string, string[]>();
    for (const r of rows) {
      const k = `${r.submittedBy}\u0001${stableJson(r.data)}`;
      const g = exactMap.get(k);
      if (g) g.push(r.id); else exactMap.set(k, [r.id]);
    }
    const exact = [...exactMap.values()].filter((g) => g.length > 1);
    // Exact copies count once inside a probable cluster; keep clusters that still hold 2+ distinct fiches.
    const rep = new Map<string, string>();
    for (const g of exact) for (const id of g) rep.set(id, g[0]);
    const probable = templateRule
      ? clusterDuplicates(templateRule, rows).filter((g) => new Set(g.map((id) => rep.get(id) ?? id)).size > 1)
      : [];
    return { exact, probable };
  }

  async names(userIds: string[]): Promise<Map<string, string>> {
    const ids = [...new Set(userIds.filter(Boolean))];
    if (!ids.length) return new Map();
    const rows: any[] = await (this.prisma as any).$queryRawUnsafe(
      `SELECT id::text AS id, first_name || ' ' || last_name AS name FROM public.users WHERE id = ANY($1::uuid[])`,
      ids,
    ).catch(() => []);
    return new Map(rows.map((r) => [r.id, r.name]));
  }

  private toCandidate(r: any, names: Map<string, string>): DuplicateCandidate {
    return {
      id: r.id,
      submittedAt: new Date(r.submitted_at).toISOString(),
      submittedBy: r.submitted_by,
      submittedByName: names.get(r.submitted_by) ?? null,
      status: r.status,
    };
  }
}

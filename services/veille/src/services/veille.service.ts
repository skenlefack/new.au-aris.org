import type { PrismaClient } from '@prisma/client';
import type { AuthenticatedUser } from '@aris/auth-middleware';

export const SIGNAL_STATUSES = ['NEW', 'IN_REVIEW', 'TO_VERIFY', 'VALIDATED', 'REJECTED', 'INTEGRATED'] as const;
export type SignalStatus = (typeof SIGNAL_STATUSES)[number];

/** Allowed triage transitions. INTEGRATED is final. */
export const TRANSITIONS: Record<SignalStatus, SignalStatus[]> = {
  NEW: ['IN_REVIEW', 'TO_VERIFY', 'VALIDATED', 'REJECTED'],
  IN_REVIEW: ['TO_VERIFY', 'VALIDATED', 'REJECTED'],
  TO_VERIFY: ['IN_REVIEW', 'VALIDATED', 'REJECTED'],
  VALIDATED: ['IN_REVIEW', 'REJECTED', 'INTEGRATED'],
  REJECTED: ['IN_REVIEW'],
  INTEGRATED: [],
};

const RELIABILITY = ['A', 'B', 'C', 'D', 'E', 'F'];
const CONFIDENCE = ['RUMOR', 'VERIFIED', 'CONFIRMED'];
const CLASSIFICATIONS = ['PUBLIC', 'PARTNER', 'RESTRICTED', 'CONFIDENTIAL'];
const CATEGORIES = ['outbreak', 'trade', 'market', 'policy', 'climate', 'wildlife', 'production', 'other'];

const httpError = (statusCode: number, message: string) => Object.assign(new Error(message), { statusCode });

const terms = (v: unknown): string[] =>
  Array.isArray(v) ? [...new Set(v.map((t) => String(t).trim()).filter((t) => t.length > 0 && t.length <= 120))].slice(0, 200) : [];

const isoList = (v: unknown): string[] =>
  Array.isArray(v) ? [...new Set(v.map((c) => String(c).trim().toUpperCase()).filter((c) => /^[A-Z]{2}$/.test(c)))] : [];

export interface SignalQuery {
  status?: string;
  domain?: string;
  category?: string;
  country?: string;
  severity?: string;
  sourceId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export class VeilleService {
  constructor(private readonly prisma: PrismaClient) {}

  private get db(): any {
    return this.prisma as any;
  }

  /**
   * Countries a user may see signals for: null = all (continental), otherwise the tenant's country
   * or the member states of its REC. Signals with no detected country stay continental.
   */
  async scopeCountries(user: AuthenticatedUser): Promise<string[] | null> {
    if (user.tenantLevel === 'CONTINENTAL') return null;
    const tenant = await this.db.tenant.findUnique({ where: { id: user.tenantId }, select: { level: true, countryCode: true } });
    if (tenant?.level === 'MEMBER_STATE' && tenant.countryCode) return [tenant.countryCode.toUpperCase()];
    const members = await this.db.tenant.findMany({ where: { parentId: user.tenantId, level: 'MEMBER_STATE' }, select: { countryCode: true } });
    return members.map((m: { countryCode: string | null }) => m.countryCode?.toUpperCase()).filter(Boolean);
  }

  /* ── Sources ── */

  listSources() {
    return this.db.watchSource.findMany({ orderBy: [{ isActive: 'desc' }, { name: 'asc' }] }).then(async (rows: any[]) => {
      const counts = await this.db.watchSignal.groupBy({ by: ['sourceId'], _count: { _all: true } });
      const byId = new Map(counts.map((c: any) => [c.sourceId, c._count._all]));
      return { data: rows.map((r) => ({ ...r, signalCount: byId.get(r.id) ?? 0 })) };
    });
  }

  private sourceData(body: any, partial: boolean) {
    const data: Record<string, unknown> = {};
    if (!partial || body.name !== undefined) {
      if (!String(body.name ?? '').trim()) throw httpError(400, 'name is required');
      data.name = String(body.name).trim().slice(0, 255);
    }
    if (!partial || body.type !== undefined) {
      if (!['RSS', 'GDELT'].includes(body.type)) throw httpError(400, 'type must be RSS or GDELT');
      data.type = body.type;
    }
    if (!partial || body.url !== undefined) {
      try {
        const u = new URL(String(body.url));
        if (!['http:', 'https:'].includes(u.protocol)) throw new Error();
      } catch {
        throw httpError(400, 'url must be an http(s) URL');
      }
      data.url = String(body.url).trim();
    }
    if (body.countryCode !== undefined) data.countryCode = isoList([body.countryCode])[0] ?? null;
    if (body.language !== undefined) data.language = body.language ? String(body.language).slice(0, 5) : null;
    if (body.reliability !== undefined) {
      if (!RELIABILITY.includes(body.reliability)) throw httpError(400, 'reliability must be A–F');
      data.reliability = body.reliability;
    }
    if (body.intervalMinutes !== undefined) {
      const n = Number(body.intervalMinutes);
      if (!Number.isInteger(n) || n < 15 || n > 10_080) throw httpError(400, 'intervalMinutes must be between 15 and 10080');
      data.intervalMinutes = n;
    }
    if (body.isActive !== undefined) data.isActive = !!body.isActive;
    return data;
  }

  async createSource(body: any, user: AuthenticatedUser) {
    return { data: await this.db.watchSource.create({ data: { ...this.sourceData(body, false), createdBy: user.userId } }) };
  }

  async updateSource(id: string, body: any) {
    await this.getOr404('watchSource', id);
    return { data: await this.db.watchSource.update({ where: { id }, data: this.sourceData(body, true) }) };
  }

  async deleteSource(id: string) {
    await this.getOr404('watchSource', id);
    await this.db.watchSource.delete({ where: { id } });
    return { data: { id } };
  }

  /* ── Watchlists ── */

  async listWatchLists() {
    return { data: await this.db.watchList.findMany({ orderBy: [{ isActive: 'desc' }, { domain: 'asc' }, { name: 'asc' }] }) };
  }

  private async watchListData(body: any, partial: boolean) {
    const data: Record<string, unknown> = {};
    if (!partial || body.name !== undefined) {
      if (!String(body.name ?? '').trim()) throw httpError(400, 'name is required');
      data.name = String(body.name).trim().slice(0, 255);
    }
    if (!partial || body.domain !== undefined) {
      if (!/^[a-z][a-z0-9-]{1,49}$/.test(String(body.domain ?? ''))) throw httpError(400, 'domain is required');
      data.domain = body.domain;
    }
    if (body.description !== undefined) data.description = body.description ? String(body.description) : null;
    if (body.anyTerms !== undefined) data.anyTerms = terms(body.anyTerms);
    if (body.allTerms !== undefined) data.allTerms = terms(body.allTerms);
    if (body.excludeTerms !== undefined) data.excludeTerms = terms(body.excludeTerms);
    if (body.countries !== undefined) data.countries = isoList(body.countries);
    if (body.isActive !== undefined) data.isActive = !!body.isActive;
    if (body.campaignId !== undefined) {
      data.campaignId = body.campaignId || null;
      if (body.campaignId) await this.assertCampaign(body.campaignId);
    }
    const keywordCount = ((data.anyTerms as string[] | undefined)?.length ?? 0) + ((data.allTerms as string[] | undefined)?.length ?? 0);
    if (!partial && keywordCount === 0) throw httpError(400, 'at least one keyword is required');
    return data;
  }

  async createWatchList(body: any, user: AuthenticatedUser) {
    return { data: await this.db.watchList.create({ data: { ...(await this.watchListData(body, false)), createdBy: user.userId } }) };
  }

  async updateWatchList(id: string, body: any) {
    await this.getOr404('watchList', id);
    return { data: await this.db.watchList.update({ where: { id }, data: await this.watchListData(body, true) }) };
  }

  async deleteWatchList(id: string) {
    await this.getOr404('watchList', id);
    await this.db.watchList.delete({ where: { id } });
    return { data: { id } };
  }

  /* ── Signals ── */

  private async signalWhere(q: SignalQuery, user: AuthenticatedUser) {
    const where: Record<string, unknown> = {};
    const and: Record<string, unknown>[] = [];
    if (q.status && SIGNAL_STATUSES.includes(q.status as SignalStatus)) where.status = q.status;
    if (q.domain) where.domain = q.domain;
    if (q.category) where.category = q.category;
    if (q.sourceId) where.sourceId = q.sourceId;
    if (q.severity && ['1', '2', '3'].includes(q.severity)) where.severity = Number(q.severity);
    if (q.country) and.push({ countries: { has: q.country.toUpperCase() } });
    if (q.search?.trim()) {
      and.push({ OR: [{ title: { contains: q.search.trim(), mode: 'insensitive' } }, { excerpt: { contains: q.search.trim(), mode: 'insensitive' } }] });
    }
    const scope = await this.scopeCountries(user);
    if (scope) and.push({ countries: { hasSome: scope.length > 0 ? scope : ['__'] } });
    if (and.length) where.AND = and;
    return where;
  }

  async listSignals(q: SignalQuery, user: AuthenticatedUser) {
    const page = Math.max(1, q.page ?? 1);
    const limit = Math.min(100, Math.max(1, q.limit ?? 20));
    const where = await this.signalWhere(q, user);
    const [data, total] = await Promise.all([
      this.db.watchSignal.findMany({
        where,
        orderBy: [{ priority: 'desc' }, { collectedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: { source: { select: { id: true, name: true, type: true } } },
      }),
      this.db.watchSignal.count({ where }),
    ]);
    return { data, meta: { total, page, limit } };
  }

  async getSignal(id: string, user: AuthenticatedUser) {
    const signal = await this.db.watchSignal.findUnique({
      where: { id },
      include: { source: { select: { id: true, name: true, type: true, url: true } }, actions: { orderBy: { createdAt: 'desc' } } },
    });
    if (!signal || !(await this.canSee(signal, user))) throw httpError(404, `Signal ${id} not found`);
    return { data: signal };
  }

  private async canSee(signal: { countries: string[] }, user: AuthenticatedUser): Promise<boolean> {
    const scope = await this.scopeCountries(user);
    return !scope || signal.countries.some((c) => scope.includes(c));
  }

  /** Change status and/or correct the classification; every change is logged. */
  async reviewSignal(id: string, body: any, user: AuthenticatedUser) {
    const { data: signal } = await this.getSignal(id, user);
    const data: Record<string, unknown> = {};
    let toStatus: SignalStatus | undefined;
    if (body.status !== undefined && body.status !== signal.status) {
      if (!TRANSITIONS[signal.status as SignalStatus]?.includes(body.status)) {
        throw httpError(409, `Cannot move a signal from ${signal.status} to ${body.status}`);
      }
      if (body.status === 'INTEGRATED') throw httpError(400, 'Use the integrate action');
      if (body.status === 'REJECTED' && !String(body.note ?? '').trim()) throw httpError(400, 'A reason is required to reject');
      toStatus = body.status;
      data.status = toStatus;
    }
    if (body.domain !== undefined) data.domain = String(body.domain).slice(0, 50);
    if (body.category !== undefined) {
      if (!CATEGORIES.includes(body.category)) throw httpError(400, 'invalid category');
      data.category = body.category;
    }
    if (body.severity !== undefined) {
      if (![1, 2, 3].includes(Number(body.severity))) throw httpError(400, 'severity must be 1, 2 or 3');
      data.severity = Number(body.severity);
    }
    if (body.confidence !== undefined) {
      if (!CONFIDENCE.includes(body.confidence)) throw httpError(400, 'invalid confidence');
      data.confidence = body.confidence;
    }
    if (body.countries !== undefined) data.countries = isoList(body.countries);
    if (Object.keys(data).length === 0 && !body.note) return { data: signal };

    data.reviewedBy = user.userId;
    data.reviewedAt = new Date();
    if (body.note !== undefined) data.reviewNote = body.note ? String(body.note).slice(0, 4000) : null;
    const [updated] = await this.prisma.$transaction([
      this.db.watchSignal.update({ where: { id }, data }),
      this.db.watchTriageAction.create({
        data: {
          signalId: id, actorId: user.userId, actorRole: user.role,
          action: toStatus ? 'status' : 'edit', fromStatus: toStatus ? signal.status : null, toStatus: toStatus ?? null,
          note: body.note ? String(body.note).slice(0, 4000) : null,
        },
      }),
    ]);
    return { data: updated };
  }

  /** Integrate a validated signal into a collecte campaign or the published watch dataset. */
  async integrateSignal(id: string, body: any, user: AuthenticatedUser) {
    const { data: signal } = await this.getSignal(id, user);
    if (signal.status !== 'VALIDATED') throw httpError(409, 'Only a validated signal can be integrated');
    const target = body.target;
    if (!['campaign', 'dataset'].includes(target)) throw httpError(400, 'target must be campaign or dataset');
    const data: Record<string, unknown> = { status: 'INTEGRATED', integrationTarget: target, reviewedBy: user.userId, reviewedAt: new Date() };
    if (target === 'campaign') {
      if (!body.campaignId) throw httpError(400, 'campaignId is required');
      await this.assertCampaign(body.campaignId);
      data.campaignId = body.campaignId;
    }
    if (body.dataClassification !== undefined) {
      if (!CLASSIFICATIONS.includes(body.dataClassification)) throw httpError(400, 'invalid dataClassification');
      data.dataClassification = body.dataClassification;
    }
    const [updated] = await this.prisma.$transaction([
      this.db.watchSignal.update({ where: { id }, data }),
      this.db.watchTriageAction.create({
        data: {
          signalId: id, actorId: user.userId, actorRole: user.role, action: `integrate:${target}`,
          fromStatus: 'VALIDATED', toStatus: 'INTEGRATED', note: body.note ? String(body.note).slice(0, 4000) : null,
        },
      }),
    ]);
    return { data: updated };
  }

  /* ── Dataset and statistics ── */

  /** Signals published as a data source; non-triage readers only get PUBLIC and PARTNER rows. */
  async dataset(q: { domain?: string; from?: string; to?: string; country?: string }, user: AuthenticatedUser, fullAccess: boolean) {
    const where: Record<string, unknown> = { status: 'INTEGRATED', integrationTarget: 'dataset' };
    if (!fullAccess) where.dataClassification = { in: ['PUBLIC', 'PARTNER'] };
    if (q.domain) where.domain = q.domain;
    const range: Record<string, Date> = {};
    if (q.from && !Number.isNaN(Date.parse(q.from))) range.gte = new Date(q.from);
    if (q.to && !Number.isNaN(Date.parse(q.to))) range.lte = new Date(q.to);
    if (Object.keys(range).length) where.publishedAt = range;
    const and: Record<string, unknown>[] = [];
    if (q.country) and.push({ countries: { has: q.country.toUpperCase() } });
    const scope = await this.scopeCountries(user);
    if (scope) and.push({ countries: { hasSome: scope.length ? scope : ['__'] } });
    if (and.length) where.AND = and;
    const rows = await this.db.watchSignal.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      take: 5000,
      include: { source: { select: { name: true } } },
    });
    return rows.map((r: any) => ({
      id: r.id, publishedAt: r.publishedAt, domain: r.domain, category: r.category, countries: r.countries,
      severity: r.severity, confidence: r.confidence, reliability: r.reliability, title: r.title, summary: r.aiSummary,
      url: r.url, source: r.source?.name, dataClassification: r.dataClassification, validatedAt: r.reviewedAt,
    }));
  }

  async stats(user: AuthenticatedUser) {
    const scope = await this.scopeCountries(user);
    const where = scope ? { countries: { hasSome: scope.length ? scope : ['__'] } } : {};
    const since = new Date(Date.now() - 7 * 86_400_000);
    const [byStatus, byDomain, byCategory, last7, alerts, sources] = await Promise.all([
      this.db.watchSignal.groupBy({ by: ['status'], where, _count: { _all: true } }),
      this.db.watchSignal.groupBy({ by: ['domain'], where, _count: { _all: true } }),
      this.db.watchSignal.groupBy({ by: ['category'], where, _count: { _all: true } }),
      this.db.watchSignal.count({ where: { ...where, collectedAt: { gte: since } } }),
      this.db.watchSignal.count({ where: { ...where, severity: 3, status: { in: ['NEW', 'IN_REVIEW', 'TO_VERIFY'] } } }),
      this.db.watchSource.findMany({ select: { isActive: true, lastStatus: true } }),
    ]);
    const flat = (rows: any[], key: string) => Object.fromEntries(rows.map((r) => [r[key], r._count._all]));
    return {
      data: {
        byStatus: flat(byStatus, 'status'),
        byDomain: flat(byDomain, 'domain'),
        byCategory: flat(byCategory, 'category'),
        last7Days: last7,
        openAlerts: alerts,
        sources: {
          total: sources.length,
          active: sources.filter((s: any) => s.isActive).length,
          failing: sources.filter((s: any) => s.isActive && s.lastStatus === 'error').length,
        },
      },
    };
  }

  /* ── Helpers ── */

  private async getOr404(model: 'watchSource' | 'watchList', id: string) {
    const row = await this.db[model].findUnique({ where: { id } });
    if (!row) throw httpError(404, `${model === 'watchSource' ? 'Source' : 'Watchlist'} ${id} not found`);
    return row;
  }

  private async assertCampaign(id: string) {
    if (!/^[0-9a-f-]{36}$/i.test(String(id))) throw httpError(400, 'invalid campaignId');
    const found = await this.db.collectionCampaign.findUnique({ where: { id }, select: { id: true } });
    if (!found) throw httpError(400, 'Campaign not found');
  }
}

/** CSV for the dataset export (RFC 4180 quoting). */
export function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return '';
  const cols = Object.keys(rows[0]);
  const cell = (v: unknown) => {
    const s = v instanceof Date ? v.toISOString() : Array.isArray(v) ? v.join('|') : v == null ? '' : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n');
}

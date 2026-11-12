/**
 * Consistency review of collected submissions:
 *  - suggests inconsistencies on each submission (rules in consistency-rules.ts)
 *  - lets a validator correct fields directly (audited, original values kept)
 *  - lets a validator send the submission back to the collector with the list
 *    of points to fix (status RETURNED + in-app notification)
 *  - returns the review history (requests, corrections, resubmissions)
 */
import type { PrismaClient, Prisma } from '@prisma/client';
import { TenantLevel } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  checkSubmission,
  summarize,
  computeStats,
  allFields,
  toNumber,
  haversineKm,
  isEmpty,
  type ConsistencyIssue,
  type GeoEntityInfo,
  type NumericStats,
  type SchemaLike,
  type AdminSuggestion,
} from './consistency-rules';
import { HttpError } from '../submission.service';

const SERVICE_NAME = 'collecte-service';
const CONTEXT_TTL_MS = 10 * 60 * 1000;
const SAMPLE_SIZE = 5000;

export const REVIEWER_ROLES = ['SUPER_ADMIN', 'CONTINENTAL_ADMIN', 'REC_ADMIN', 'NATIONAL_ADMIN', 'DATA_STEWARD', 'WAHIS_FOCAL_POINT'];

interface LocatedPoint { lat: number; lng: number; admin: Record<string, string>; country: string | null }

interface CampaignContext {
  loadedAt: number;
  stats: Map<string, NumericStats>;
  /** Recent submissions whose admin areas all exist, with a GPS point. */
  located: LocatedPoint[];
  geo: Map<string, GeoEntityInfo>;
}

export interface CorrectionItem { field?: string; code?: string; message: string }

export interface FieldMeta {
  label: unknown;
  type: string;
  options?: { value: string; label: unknown }[];
  min?: number;
  max?: number;
}

export class ConsistencyService {
  private readonly contexts = new Map<string, CampaignContext>();
  private readonly schemas = new Map<string, { at: number; schema: SchemaLike | null }>();

  constructor(private readonly prisma: PrismaClient) {}

  // ── Read ──

  async check(id: string, user: AuthenticatedUser): Promise<{ data: Record<string, unknown> }> {
    const sub = await this.loadAccessible(id, user);
    const issues = await this.issuesFor(sub, true);
    const schema = await this.schemaFor(sub.templateId);
    const wanted = new Set(issues.flatMap((i) => i.fields));
    const fields: Record<string, FieldMeta> = {};
    for (const f of allFields(schema)) {
      if (!wanted.has(f.code)) continue;
      const opts = Array.isArray((f.properties as any)?.options) ? (f.properties as any).options : null;
      fields[f.code] = {
        label: f.label ?? f.code,
        type: f.type,
        ...(opts ? { options: opts.map((o: any) => ({ value: String(o?.value ?? o), label: o?.label ?? String(o?.value ?? o) })) } : {}),
        ...(f.validation?.min !== undefined ? { min: f.validation.min } : {}),
        ...(f.validation?.max !== undefined ? { max: f.validation.max } : {}),
      };
    }
    return {
      data: {
        submissionId: sub.id, version: sub.version, status: sub.status, submittedBy: sub.submittedBy,
        issues, fields, summary: summarize(issues), checkedAt: new Date().toISOString(),
      },
    };
  }

  /** Issue counts for a page of submissions (list badges). Duplicate check skipped for speed. */
  async summaries(ids: string[], user: AuthenticatedUser): Promise<{ data: Record<string, ReturnType<typeof summarize>> }> {
    const unique = [...new Set(ids)].slice(0, 200);
    const where: Record<string, unknown> = { id: { in: unique } };
    if (user.tenantLevel !== TenantLevel.CONTINENTAL) where.tenantId = user.tenantId;
    const subs: any[] = await (this.prisma as any).submission.findMany({ where });
    const out: Record<string, ReturnType<typeof summarize>> = {};
    for (const s of subs) {
      try {
        out[s.id] = summarize(await this.issuesFor(s, false));
      } catch {
        // one bad record must not break the page
      }
    }
    return { data: out };
  }

  async history(id: string, user: AuthenticatedUser): Promise<{ data: any[] }> {
    await this.loadAccessible(id, user);
    const rows: any[] = await (this.prisma as any).$queryRawUnsafe(
      `SELECT a.id, a.action, a.reason, a.previous_version, a.new_version, a.timestamp, a.actor_user_id, a.actor_role,
              NULLIF(TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')), '') AS actor_name
         FROM audit.audit_log a
         LEFT JOIN public.users u ON u.id = a.actor_user_id
        WHERE a.entity_type = 'submission' AND a.entity_id = $1::uuid
          AND a.action IN ('REQUEST_CORRECTION','CORRECT','RESUBMIT','VALIDATE','REJECT','RETURN')
        ORDER BY a.timestamp DESC
        LIMIT 100`,
      id,
    );
    return {
      data: rows.map((r) => ({
        id: r.id,
        action: r.action,
        reason: r.reason,
        previous: r.previous_version,
        next: r.new_version,
        at: r.timestamp,
        actor: { id: r.actor_user_id, role: r.actor_role, name: r.actor_name },
      })),
    };
  }

  // ── Write ──

  /** A validator fixes fields directly. Status is unchanged; old values go to the audit trail. */
  async correct(id: string, changes: Record<string, unknown>, reason: string, user: AuthenticatedUser): Promise<{ data: any }> {
    if (!REVIEWER_ROLES.includes(user.role)) throw new HttpError(403, 'Only validators can correct submissions');
    const sub = await this.loadAccessible(id, user);
    if (['DRAFT', 'CONFLICT'].includes(sub.status)) {
      throw new HttpError(400, `Submission ${id} cannot be corrected while its status is ${sub.status}`);
    }
    const keys = Object.keys(changes ?? {});
    if (keys.length === 0) throw new HttpError(400, 'No change given');
    if (!reason || !reason.trim()) throw new HttpError(400, 'A reason is required');

    const schema = await this.schemaFor(sub.templateId);
    const known = new Set(allFields(schema).map((f) => f.code));
    const unknown = keys.filter((k) => known.size > 0 && !known.has(k));
    if (unknown.length) throw new HttpError(400, `Unknown field(s): ${unknown.join(', ')}`);

    const data: Record<string, unknown> = { ...(sub.data ?? {}) };
    const previous: Record<string, unknown> = {};
    const next: Record<string, unknown> = {};
    for (const k of keys) {
      const v = changes[k];
      if (JSON.stringify(data[k] ?? null) === JSON.stringify(v ?? null)) continue;
      previous[k] = data[k] ?? null;
      next[k] = v ?? null;
      if (v === null || v === undefined) delete data[k];
      else data[k] = v;
    }
    if (Object.keys(next).length === 0) throw new HttpError(400, 'The new values are the same as the current ones');

    // Optimistic lock on version: refuse if someone changed it in the meantime.
    const res = await (this.prisma as any).submission.updateMany({
      where: { id, version: sub.version },
      data: { data: data as Prisma.InputJsonValue, version: { increment: 1 } },
    });
    if (res.count !== 1) throw new HttpError(409, 'The submission was changed by someone else. Reload and try again.');

    await this.audit('CORRECT', id, user, reason.trim(), previous, { ...next, version: sub.version + 1 }, sub.dataClassification);
    const updated = await (this.prisma as any).submission.findUnique({ where: { id } });
    return { data: updated };
  }

  /** Send the submission back to the collector with the list of points to fix. */
  async requestCorrection(id: string, message: string, items: CorrectionItem[], user: AuthenticatedUser): Promise<{ data: any }> {
    if (!REVIEWER_ROLES.includes(user.role)) throw new HttpError(403, 'Only validators can request corrections');
    const sub = await this.loadAccessible(id, user);
    if (sub.submittedBy === user.userId) throw new HttpError(400, 'You cannot send your own submission back to yourself');
    if (!['SUBMITTED', 'VALIDATING', 'VALIDATED', 'REJECTED', 'RETURNED'].includes(sub.status)) {
      throw new HttpError(400, `Submission ${id} cannot be returned while its status is ${sub.status}`);
    }
    const cleanItems = (items ?? []).filter((i) => i && typeof i.message === 'string' && i.message.trim()).slice(0, 50)
      .map((i) => ({ field: i.field, code: i.code, message: i.message.trim().slice(0, 1000) }));
    const text = (message ?? '').trim();
    if (!text && cleanItems.length === 0) throw new HttpError(400, 'Add a message or at least one point to fix');

    const res = await (this.prisma as any).submission.updateMany({
      where: { id, version: sub.version },
      data: { status: 'RETURNED' },
    });
    if (res.count !== 1) throw new HttpError(409, 'The submission was changed by someone else. Reload and try again.');

    await this.audit('REQUEST_CORRECTION', id, user, text || null, { status: sub.status }, { status: 'RETURNED', items: cleanItems, version: sub.version }, sub.dataClassification);
    await this.notifyCollector(sub, user, text, cleanItems);
    const updated = await (this.prisma as any).submission.findUnique({ where: { id } });
    return { data: updated };
  }

  // ── Internals ──

  async audit(action: string, entityId: string, user: AuthenticatedUser, reason: string | null, previous: object | null, next: object | null, classification?: string): Promise<void> {
    try {
      await (this.prisma as any).auditLog.create({
        data: {
          entityType: 'submission',
          entityId,
          action,
          actorUserId: user.userId,
          actorRole: user.role,
          actorTenantId: user.tenantId,
          reason: reason ?? undefined,
          previousVersion: previous ?? undefined,
          newVersion: next ?? undefined,
          dataClassification: classification ?? 'RESTRICTED',
          serviceName: SERVICE_NAME,
        },
      });
    } catch (err) {
      console.error(`[Consistency] audit ${action} ${entityId} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async notifyCollector(sub: any, user: AuthenticatedUser, message: string, items: CorrectionItem[]): Promise<void> {
    try {
      let campaignName = '';
      const cam = await (this.prisma as any).collectionCampaign.findUnique({ where: { id: sub.campaignId }, select: { name: true } }).catch(() => null);
      if (cam?.name) campaignName = typeof cam.name === 'string' ? cam.name : cam.name.en || cam.name.fr || '';
      const lines = items.map((i) => `- ${i.message}`).join('\n');
      const body = [
        `A validator sent your submission back for correction${campaignName ? ` (${campaignName})` : ''}.`,
        message ? `\nMessage: ${message}` : '',
        lines ? `\nPoints to fix:\n${lines}` : '',
      ].join('').slice(0, 4000);
      await (this.prisma as any).$executeRawUnsafe(
        `INSERT INTO public.notifications
           (id, tenant_id, user_id, channel, subject, body, status, metadata, sent_at, created_at, updated_at)
         SELECT gen_random_uuid(), u.tenant_id, u.id, 'IN_APP'::public.notification_channel, $2, $3,
                'SENT'::public.notification_status, $4::jsonb, NOW(), NOW(), NOW()
           FROM public.users u WHERE u.id = $1::uuid`,
        sub.submittedBy,
        'Submission returned for correction',
        body,
        JSON.stringify({
          source: 'collecte-review', kind: 'correction-requested', submissionId: sub.id,
          campaignId: sub.campaignId, requestedBy: user.userId, link: `/collecte/submissions/${sub.id}/edit`,
        }),
      );
    } catch (err) {
      console.error(`[Consistency] notification for ${sub.id} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async loadAccessible(id: string, user: AuthenticatedUser): Promise<any> {
    const sub = await (this.prisma as any).submission.findUnique({ where: { id } });
    if (!sub) throw new HttpError(404, `Submission ${id} not found`);
    if (user.tenantLevel !== TenantLevel.CONTINENTAL && sub.tenantId !== user.tenantId) {
      throw new HttpError(404, `Submission ${id} not found`);
    }
    return sub;
  }

  private async schemaFor(templateId: string | null): Promise<SchemaLike | null> {
    if (!templateId) return null;
    const c = this.schemas.get(templateId);
    if (c && Date.now() - c.at < CONTEXT_TTL_MS) return c.schema;
    const t = await (this.prisma as any).formTemplate.findUnique({ where: { id: templateId }, select: { schema: true } }).catch(() => null);
    const schema = (t?.schema && typeof t.schema === 'object' ? t.schema : null) as SchemaLike | null;
    this.schemas.set(templateId, { at: Date.now(), schema });
    return schema;
  }

  private async issuesFor(sub: any, withDuplicates: boolean): Promise<ConsistencyIssue[]> {
    const schema = await this.schemaFor(sub.templateId);
    const data = (sub.data ?? {}) as Record<string, unknown>;
    const ctx = await this.campaignContext(sub.campaignId, schema);
    const adminFields = allFields(schema).filter((f) => f.type === 'admin-location' || f.type === 'admin_location');

    // Geo entities referenced by this submission (cache first, then DB)
    const ids = new Set<string>();
    for (const f of adminFields) for (const id of adminIds(data[f.code])) ids.add(id);
    const geo = new Map<string, GeoEntityInfo>();
    const missing: string[] = [];
    for (const id of ids) { const g = ctx.geo.get(id); if (g) geo.set(id, g); else missing.push(id); }
    if (missing.length) for (const [k, v] of await this.loadGeo(missing)) geo.set(k, v);

    let country: string | null = null;
    for (const f of adminFields) {
      const l0 = (data[f.code] as any)?.level_0;
      if (typeof l0 === 'string' && /^[A-Z]{2}$/i.test(l0)) { country = l0.toUpperCase(); break; }
    }
    if (!country) country = await this.tenantCountry(sub.tenantId);

    // Location suggestion for areas that no longer exist
    const adminSuggestions = new Map<string, AdminSuggestion | null>();
    const point = pointOf(data, schema) ?? (sub.gpsLat != null && sub.gpsLng != null ? { lat: sub.gpsLat, lng: sub.gpsLng } : null);
    for (const f of adminFields) {
      const unknown = adminIds(data[f.code]).some((id) => !geo.has(id));
      adminSuggestions.set(f.code, unknown && point ? this.suggestArea(point, country, ctx) : null);
    }

    let duplicateIds: string[] = [];
    if (withDuplicates && sub.submittedBy) {
      const rows: any[] = await (this.prisma as any).$queryRawUnsafe(
        `SELECT id FROM public.submissions
          WHERE campaign_id = $1::uuid AND submitted_by = $2::uuid AND id <> $3::uuid AND data = $4::jsonb
          LIMIT 10`,
        sub.campaignId, sub.submittedBy, sub.id, JSON.stringify(data),
      ).catch(() => []);
      duplicateIds = rows.map((r) => r.id);
    }

    return checkSubmission({
      data,
      schema,
      submittedAt: new Date(sub.submittedAt),
      countryCode: country,
      geo,
      stats: ctx.stats,
      duplicateIds,
      adminSuggestions,
      gps: { lat: sub.gpsLat ?? null, lng: sub.gpsLng ?? null },
    });
  }

  private suggestArea(point: { lat: number; lng: number }, country: string | null, ctx: CampaignContext): AdminSuggestion | null {
    let best: LocatedPoint | null = null;
    let bestKm = Infinity;
    for (const p of ctx.located) {
      if (country && p.country && p.country !== country) continue;
      const km = haversineKm(point, p);
      if (km < bestKm) { bestKm = km; best = p; }
    }
    if (!best || bestKm > 15) return null;
    // The closer the neighbour, the deeper we trust its areas.
    const depth = bestKm <= 0.5 ? 5 : bestKm <= 3 ? 3 : 2;
    const value: Record<string, string> = {};
    const names: string[] = [];
    if (best.admin.level_0) value.level_0 = best.admin.level_0;
    for (let lvl = 1; lvl <= depth; lvl++) {
      const id = best.admin[`level_${lvl}`];
      if (!id) break;
      value[`level_${lvl}`] = id;
      const g = ctx.geo.get(id);
      if (g) names.push(g.name);
    }
    if (names.length === 0) return null;
    return { value, names, distanceKm: bestKm };
  }

  private async campaignContext(campaignId: string, schema: SchemaLike | null): Promise<CampaignContext> {
    const cached = this.contexts.get(campaignId);
    if (cached && Date.now() - cached.loadedAt < CONTEXT_TTL_MS) return cached;

    const rows: any[] = await (this.prisma as any).submission.findMany({
      where: { campaignId },
      select: { data: true, gpsLat: true, gpsLng: true },
      orderBy: { submittedAt: 'desc' },
      take: SAMPLE_SIZE,
    });
    const fields = allFields(schema);
    const numberCodes = fields.filter((f) => ['number', 'integer', 'decimal'].includes(f.type)).map((f) => f.code);
    const adminCodes = fields.filter((f) => f.type === 'admin-location' || f.type === 'admin_location').map((f) => f.code);

    const stats = new Map<string, NumericStats>();
    for (const code of numberCodes) {
      const vals = rows.map((r) => toNumber(r.data?.[code])).filter((n): n is number => n !== null);
      if (vals.length >= 30) stats.set(code, computeStats(vals));
    }

    const allIds = new Set<string>();
    for (const r of rows) for (const c of adminCodes) for (const id of adminIds(r.data?.[c])) allIds.add(id);
    const geo = await this.loadGeo([...allIds]);

    const located: LocatedPoint[] = [];
    for (const r of rows) {
      const p = pointOf(r.data ?? {}, schema) ?? (r.gpsLat != null && r.gpsLng != null ? { lat: r.gpsLat, lng: r.gpsLng } : null);
      if (!p) continue;
      for (const c of adminCodes) {
        const loc = r.data?.[c];
        const ids = adminIds(loc);
        if (ids.length === 0 || ids.some((id) => !geo.has(id))) continue;
        const admin: Record<string, string> = {};
        for (const [k, v] of Object.entries(loc as Record<string, unknown>)) if (typeof v === 'string') admin[k] = v;
        located.push({ ...p, admin, country: typeof admin.level_0 === 'string' ? admin.level_0.toUpperCase() : null });
        break;
      }
    }

    const ctx: CampaignContext = { loadedAt: Date.now(), stats, located, geo };
    this.contexts.set(campaignId, ctx);
    return ctx;
  }

  private async loadGeo(ids: string[]): Promise<Map<string, GeoEntityInfo>> {
    const out = new Map<string, GeoEntityInfo>();
    const uuids = ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id));
    for (let i = 0; i < uuids.length; i += 5000) {
      const chunk = uuids.slice(i, i + 5000);
      const rows: any[] = await (this.prisma as any).$queryRawUnsafe(
        `SELECT id::text AS id, parent_id::text AS parent_id, level::text AS level, COALESCE(NULLIF(name_en,''), name) AS name, country_code
           FROM public.geo_entities WHERE id = ANY($1::uuid[])`,
        chunk,
      ).catch(() => []);
      for (const r of rows) out.set(r.id, { id: r.id, parentId: r.parent_id, level: r.level, name: r.name, countryCode: r.country_code });
    }
    return out;
  }

  private async tenantCountry(tenantId: string): Promise<string | null> {
    const rows: any[] = await (this.prisma as any).$queryRawUnsafe(
      `SELECT code FROM public.tenants WHERE id = $1::uuid AND level::text = 'MEMBER_STATE'`, tenantId,
    ).catch(() => []);
    const code = rows[0]?.code;
    return typeof code === 'string' && /^[A-Z]{2}$/i.test(code) ? code.toUpperCase() : null;
  }
}

function adminIds(v: unknown): string[] {
  if (!v || typeof v !== 'object') return [];
  const out: string[] = [];
  for (let lvl = 1; lvl <= 5; lvl++) {
    const id = (v as Record<string, unknown>)[`level_${lvl}`];
    if (typeof id === 'string' && !isEmpty(id) && !id.startsWith('__new:')) out.push(id);
  }
  return out;
}

function pointOf(data: Record<string, unknown>, schema: SchemaLike | null): { lat: number; lng: number } | null {
  const geoCodes = allFields(schema).filter((f) => ['geo-point', 'geo-selector', 'gps', 'geo-location', 'geopoint', 'location-point'].includes(f.type)).map((f) => f.code);
  for (const c of geoCodes) {
    const v = data[c] as any;
    const lat = toNumber(v?.lat ?? v?.latitude);
    const lng = toNumber(v?.lng ?? v?.lon ?? v?.longitude);
    if (lat !== null && lng !== null && !(Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001)) return { lat, lng };
  }
  return null;
}

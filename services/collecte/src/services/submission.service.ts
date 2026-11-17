import { v4 as uuidv4 } from 'uuid';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import type { FastifyKafka } from '@aris/kafka-client';
import {
  EVENTS,
} from '@aris/kafka-client';
import type {
  WorkflowInstanceCreatedEvent,
} from '@aris/kafka-client';
import {
  TenantLevel,
  DataClassification,
  TOPIC_MS_COLLECTE_FORM_SUBMITTED,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from '@aris/shared-types';
import {
  canViewCampaign,
  isAccessLevelsEnabled,
  ADMIN_BYPASS_ROLES,
  type CampaignScopes,
  type VisibilityInput,
} from '@aris/access-control';
import type {
  KafkaHeaders,
  PaginationQuery,
  PaginatedResponse,
  ApiResponse,
} from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import type { SubmissionEntity } from '../submission/entities/submission.entity';
import { DuplicateService, type DuplicateCandidate, type DuplicateInfo } from './duplicates/duplicate.service';

const SERVICE_NAME = 'collecte-service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type LocalizedText = Record<string, string>;

export interface CampaignDatasetRow {
  id: string;
  tenantId: string;
  submittedBy: string;
  submittedAt: string;
  status: string;
  data: Record<string, unknown>;
}

export interface CampaignDataset {
  rows: CampaignDatasetRow[];
  geo: Record<string, { en: string; fr: string; level: string; parentId: string | null; countryCode: string }>;
  agents: Record<string, string>;
  tenants: Record<string, { name: string; code: string | null; level: string }>;
  /** Form fields by code: label, type and option labels (repeater sub-fields included). */
  fields: Record<string, { label: LocalizedText; type: string; options?: Record<string, LocalizedText> }>;
  generatedAt: string;
}

function toLocalized(v: unknown): LocalizedText {
  if (typeof v === 'string') return { en: v };
  if (v && typeof v === 'object') return v as LocalizedText;
  return {};
}

/** Walks a form template schema and records each field's label and option labels. */
export function collectFieldDictionary(schema: unknown, out: CampaignDataset['fields']): void {
  const visit = (list: unknown): void => {
    if (!Array.isArray(list)) return;
    for (const f of list as any[]) {
      if (!f || typeof f !== 'object') continue;
      const code = f.code || f.id;
      if (code && !out[code]) {
        const rawOptions = f.properties?.options ?? f.options ?? f.validation?.options;
        const options: Record<string, LocalizedText> = {};
        if (Array.isArray(rawOptions)) {
          for (const o of rawOptions) {
            if (o && o.value != null) options[String(o.value)] = toLocalized(o.label ?? o.value);
          }
        }
        out[code] = { label: toLocalized(f.label ?? code), type: String(f.type ?? 'text'), ...(Object.keys(options).length ? { options } : {}) };
      }
      visit(f.properties?.fields);
      visit(f.fields);
    }
  };
  const sections = (schema as any)?.sections;
  if (Array.isArray(sections)) for (const s of sections) visit(s?.fields);
  visit((schema as any)?.fields);
}

/** Lightweight HTTP error for Fastify error handler */
export class HttpError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

export type SubmissionAuditor = (
  action: string, entityId: string, user: AuthenticatedUser, reason: string | null,
  previous: object | null, next: object | null, classification?: string,
) => Promise<void>;

export class SubmissionService {
  private readonly ajv: Ajv;
  private auditor: SubmissionAuditor | null = null;
  private duplicatesSvc: DuplicateService | null = null;

  get duplicates(): DuplicateService {
    if (!this.duplicatesSvc) this.duplicatesSvc = new DuplicateService(this.prisma);
    return this.duplicatesSvc;
  }

  private kitIngest?: (campaignId: string, submissionId: string) => Promise<void>;

  /** Creates the PANVAC kit request of a fiche sent to a kit campaign (set by the routes, avoids an import cycle). */
  setKitIngest(fn: (campaignId: string, submissionId: string) => Promise<void>): void {
    this.kitIngest = fn;
  }

  /** Optional audit-trail writer (review history of status changes and resubmissions). */
  setAuditor(fn: SubmissionAuditor): void {
    this.auditor = fn;
  }

  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafkaProducer: StandaloneKafkaProducer,
    private readonly kafka: FastifyKafka | null,
  ) {
    this.ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(this.ajv);
  }

  async submit(
    dto: {
      campaignId: string;
      data: Record<string, unknown>;
      deviceId?: string;
      gpsLat?: number;
      gpsLng?: number;
      gpsAccuracy?: number;
      offlineCreatedAt?: string;
      dataClassification?: string;
      clientKey?: string;
      duplicateOverride?: { reason: string };
      source?: 'web' | 'import';
    },
    user: AuthenticatedUser,
  ): Promise<ApiResponse<SubmissionEntity>> {
    // 1. Load campaign — try CollectionCampaign first (new model), fallback to legacy Campaign
    let campaign: any = await (this.prisma as any).collectionCampaign.findUnique({
      where: { id: dto.campaignId },
    });
    let isCollectionCampaign = true;

    if (!campaign) {
      // Fallback: legacy Campaign table
      campaign = await (this.prisma as any).campaign.findUnique({
        where: { id: dto.campaignId },
      });
      isCollectionCampaign = false;
    }

    if (!campaign) {
      throw new HttpError(404, `Campaign ${dto.campaignId} not found`);
    }

    if (campaign.status !== 'ACTIVE') {
      throw new HttpError(
        400,
        `Campaign ${dto.campaignId} is not active (status: ${campaign.status})`,
      );
    }

    // Deadline enforcement: check start_date and end_date
    const now = new Date();
    const GRACE_PERIOD_MS = 24 * 60 * 60 * 1000; // 24 hours

    if (campaign.startDate) {
      const startDate = new Date(campaign.startDate);
      if (now < startDate) {
        throw new HttpError(
          400,
          `Campaign has not started yet. Submissions are accepted from ${startDate.toISOString().slice(0, 10)}`,
        );
      }
    }

    if (campaign.endDate) {
      const endDate = new Date(campaign.endDate);
      const deadlineWithGrace = new Date(endDate.getTime() + GRACE_PERIOD_MS);
      if (now > deadlineWithGrace) {
        throw new HttpError(
          400,
          `Campaign has ended. Submissions are no longer accepted after ${endDate.toISOString().slice(0, 10)} (24h grace period expired)`,
        );
      }
    }

    // Tenant isolation
    if (user.tenantLevel !== TenantLevel.CONTINENTAL) {
      if (isCollectionCampaign) {
        // CollectionCampaign: owner OR targeted country/REC can submit
        const canAccess = await this.canAccessCollectionCampaign(user, campaign);
        if (!canAccess) {
          throw new HttpError(404, `Campaign ${dto.campaignId} not found`);
        }
      } else {
        // Legacy Campaign: strict tenantId match
        if (campaign.tenantId && campaign.tenantId !== user.tenantId) {
          throw new HttpError(404, `Campaign ${dto.campaignId} not found`);
        }
      }
    }

    // Resolve template ID (CollectionCampaign uses formTemplateId, legacy uses templateId)
    const templateId = isCollectionCampaign ? campaign.formTemplateId : campaign.templateId;

    // Same form sent again (double click, lost response, offline replay): return the saved fiche.
    if (dto.clientKey) {
      const already = await (this.prisma as any).submission.findFirst({
        where: { campaignId: dto.campaignId, clientKey: dto.clientKey },
      });
      if (already) return { data: already as unknown as SubmissionEntity, meta: { replayed: true } } as any;
    }

    // 2. Validate required fields against form template
    const schemaErrors = await this.validateAgainstTemplate(
      templateId,
      dto.data,
    );
    if (schemaErrors.length > 0) {
      const err = new HttpError(400, 'Submission data does not match template schema');
      (err as any).errors = schemaErrors.map((e) => ({
        field: e.instancePath || '/',
        message: e.message ?? 'Validation error',
      }));
      throw err;
    }

    // Extract zone_id from admin_location field if present in form data
    let geoZoneId: string | undefined;
    if (dto.data && typeof dto.data === 'object') {
      const data = dto.data as Record<string, any>;
      for (const val of Object.values(data)) {
        if (val && typeof val === 'object' && val.zone_id) {
          geoZoneId = val.zone_id;
          break;
        }
      }
    }

    // Validate extracted geoZoneId exists (non-blocking — warn only)
    if (geoZoneId) {
      try {
        const zone = await (this.prisma as any).$queryRawUnsafe(
          `SELECT id FROM master_data.geo_zones WHERE id = $1::uuid LIMIT 1`,
          geoZoneId,
        );
        if (!zone || (Array.isArray(zone) && zone.length === 0)) {
          console.warn(`[SubmissionService] geoZoneId ${geoZoneId} not found in master_data.geo_zones — saving anyway`);
        }
      } catch (err) {
        console.warn(`[SubmissionService] Could not validate geoZoneId: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Duplicate control (exact copy, then the form's own rule)
    const duplicateMark = await this.duplicateGate(dto, templateId, user);

    // 3. Persist submission
    let submission: any;
    try {
      submission = await (this.prisma as any).submission.create({
        data: {
          clientKey: dto.clientKey ?? null,
          duplicateStatus: duplicateMark?.status ?? null,
          duplicateInfo: (duplicateMark?.info ?? undefined) as Prisma.InputJsonValue | undefined,
          tenantId: user.tenantId,
          campaignId: dto.campaignId,
          templateId,
          data: dto.data as Prisma.InputJsonValue,
          submittedBy: user.userId,
          submittedAt: new Date(),
          deviceId: dto.deviceId ?? null,
          gpsLat: dto.gpsLat ?? null,
          gpsLng: dto.gpsLng ?? null,
          gpsAccuracy: dto.gpsAccuracy ?? null,
          offlineCreatedAt: dto.offlineCreatedAt
            ? new Date(dto.offlineCreatedAt)
            : null,
          dataClassification:
            dto.dataClassification ?? DataClassification.RESTRICTED,
          status: 'SUBMITTED',
          geoZoneId: geoZoneId ?? null,
        },
      });
    } catch (e: any) {
      // Two identical requests raced past the clientKey lookup: the unique index kept one.
      if (e?.code === 'P2002' && dto.clientKey) {
        const already = await (this.prisma as any).submission.findFirst({ where: { campaignId: dto.campaignId, clientKey: dto.clientKey } });
        if (already) return { data: already as unknown as SubmissionEntity, meta: { replayed: true } } as any;
      }
      throw e;
    }
    if (duplicateMark && this.auditor) {
      this.auditor('DUPLICATE_OVERRIDE', submission.id, user, duplicateMark.info.reason ?? null, null, duplicateMark.info as any).catch(() => undefined);
    }

    // 4. Request quality validation asynchronously via Kafka event
    await this.requestQualityValidation(
      submission,
      campaign.domain ?? 'collecte', // Backward compat: reads legacy domain field, prefer targets[]
      user,
    );

    // 5. Publish submission event
    await this.publishSubmittedEvent(submission, user);

    // 6. Send notification to kit_recipient (if present in form data)
    await this.sendRecipientNotification(submission, dto.data, user);

    // 7. PANVAC kit campaign: the fiche becomes a kit request (PANVAC is notified). Never blocks the submission.
    if (this.kitIngest && (campaign as any).metadata?.module === 'panvac_kits') {
      await this.kitIngest(dto.campaignId, submission.id).catch((e) =>
        console.warn(`[SubmissionService] kit request not created: ${e instanceof Error ? e.message : String(e)}`));
    }

    console.log(
      `[SubmissionService] Submission created: ${submission.id} for campaign ${dto.campaignId}`,
    );

    return { data: submission as unknown as SubmissionEntity };
  }

  /**
   * Refuses or marks duplicates before a fiche is saved.
   * - Exact copy by the same collector: refused (409 DUPLICATE_EXACT); an import skips the row.
   * - Probable duplicate under the form rule: 409 DUPLICATE_SUSPECTED so the person can review;
   *   sending again with a reason saves it as JUSTIFIED. With action 'block' it cannot be overridden.
   * - Excel import never asks: probable duplicates are saved and marked SUSPECTED for the reviewer.
   */
  private async duplicateGate(
    dto: { campaignId: string; data: Record<string, unknown>; duplicateOverride?: { reason: string }; source?: 'web' | 'import' },
    templateId: string | null,
    user: AuthenticatedUser,
  ): Promise<{ status: 'SUSPECTED' | 'JUSTIFIED'; info: DuplicateInfo } | null> {
    let check;
    try {
      check = await this.duplicates.check(dto.campaignId, templateId, user.userId, dto.data);
    } catch (err) {
      // Never block collection because the check itself failed.
      console.warn(`[SubmissionService] duplicate check skipped: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
    const source = dto.source === 'import' ? 'import' : 'web';
    if (check.exact) {
      throw duplicateError(409, 'DUPLICATE_EXACT',
        'This fiche was already submitted with exactly the same answers.', [check.exact], null);
    }
    if (!check.rule || check.candidates.length === 0) return null;
    const info: DuplicateInfo = {
      kind: 'rule', candidateIds: check.candidates.map((c) => c.id), source, checkedAt: new Date().toISOString(),
    };
    if (source === 'import') return { status: 'SUSPECTED', info };
    if (check.rule.action === 'block') {
      throw duplicateError(409, 'DUPLICATE_BLOCKED',
        'A fiche for the same herd/entity already exists in this campaign.', check.candidates, 'block');
    }
    const reason = dto.duplicateOverride?.reason?.trim() ?? '';
    if (reason.length < 5) {
      throw duplicateError(409, 'DUPLICATE_SUSPECTED',
        'Similar fiches already exist in this campaign. Check them, or give a reason to submit anyway.', check.candidates, 'warn');
    }
    return { status: 'JUSTIFIED', info: { ...info, reason } };
  }

  /**
   * Update submission status (VALIDATED or REJECTED).
   * Used for confirmation workflows (e.g., kit reception confirmation).
   */
  async updateStatus(
    id: string,
    dto: { status: string; reason?: string },
    user: AuthenticatedUser,
  ): Promise<ApiResponse<SubmissionEntity>> {
    const submission = await (this.prisma as any).submission.findUnique({
      where: { id },
    });

    if (!submission) {
      throw new HttpError(404, `Submission ${id} not found`);
    }

    // Allow: the kit_recipient, the submitter, DATA_STEWARD, or any admin
    const isAdmin = ['SUPER_ADMIN', 'CONTINENTAL_ADMIN', 'REC_ADMIN', 'NATIONAL_ADMIN', 'DATA_STEWARD'].includes(user.role);
    const isRecipient = submission.data?.kit_recipient === user.userId;
    const isSubmitter = submission.submittedBy === user.userId;
    if (!isAdmin && !isRecipient && !isSubmitter) {
      throw new HttpError(403, 'Not authorized to update this submission status');
    }

    const updated = await (this.prisma as any).submission.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.reason ? { qualityReportId: null } : {}),
      },
    });

    console.log(
      `[SubmissionService] Submission ${id} status updated to ${dto.status} by ${user.email}${dto.reason ? ` (reason: ${dto.reason})` : ''}`,
    );

    const auditAction = dto.status === 'VALIDATED' ? 'VALIDATE' : dto.status === 'REJECTED' ? 'REJECT' : dto.status === 'RETURNED' ? 'RETURN' : 'UPDATE';
    await this.auditor?.(auditAction, id, user, dto.reason ?? null, { status: submission.status }, { status: dto.status }, submission.dataClassification);

    return { data: updated as unknown as SubmissionEntity };
  }

  /**
   * Update submission data for correction/resubmission.
   * Only allowed when status is RETURNED, REJECTED, or SUBMITTED.
   * Resets status to SUBMITTED, increments version, and re-triggers quality validation.
   */
  async updateData(
    id: string,
    data: Record<string, unknown>,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<SubmissionEntity>> {
    // 1. Find submission
    const submission = await (this.prisma as any).submission.findUnique({
      where: { id },
    });

    if (!submission) {
      throw new HttpError(404, `Submission ${id} not found`);
    }

    // Tenant isolation (a REC also sees its member countries)
    if (!(await this.canSeeTenant(user, submission.tenantId))) {
      throw new HttpError(404, `Submission ${id} not found`);
    }

    // 2. Guard: only allow update if status is RETURNED, REJECTED, or SUBMITTED
    const editableStatuses = ['RETURNED', 'REJECTED', 'SUBMITTED'];
    if (!editableStatuses.includes(submission.status)) {
      throw new HttpError(
        400,
        `Submission ${id} cannot be edited (status: ${submission.status}). Only RETURNED, REJECTED, or SUBMITTED submissions can be corrected.`,
      );
    }

    // Authorization: submitter or admin
    const isAdmin = ['SUPER_ADMIN', 'CONTINENTAL_ADMIN', 'REC_ADMIN', 'NATIONAL_ADMIN'].includes(user.role);
    if (!isAdmin && submission.submittedBy !== user.userId) {
      throw new HttpError(403, 'Not authorized to edit this submission');
    }

    // 3. Update submission: new data, reset status to SUBMITTED, increment version
    const updated = await (this.prisma as any).submission.update({
      where: { id },
      data: {
        data: data as Prisma.InputJsonValue,
        status: 'SUBMITTED',
        version: { increment: 1 },
      },
    });

    // Audit: which fields the collector changed, so validators see what was fixed
    {
      const before = (submission.data ?? {}) as Record<string, unknown>;
      const prev: Record<string, unknown> = {};
      const next: Record<string, unknown> = {};
      for (const k of new Set([...Object.keys(before), ...Object.keys(data)])) {
        if (JSON.stringify(before[k] ?? null) !== JSON.stringify((data as Record<string, unknown>)[k] ?? null)) {
          prev[k] = before[k] ?? null;
          next[k] = (data as Record<string, unknown>)[k] ?? null;
        }
      }
      await this.auditor?.('RESUBMIT', id, user, null, { ...prev, status: submission.status }, { ...next, status: 'SUBMITTED', version: updated.version }, submission.dataClassification);
    }

    // 4. Re-trigger quality validation via Kafka event
    // Resolve campaign domain
    let domain = 'collecte';
    try {
      let cam = await (this.prisma as any).collectionCampaign.findUnique({
        where: { id: submission.campaignId },
        select: { domain: true },
      });
      if (!cam) {
        cam = await (this.prisma as any).campaign.findUnique({
          where: { id: submission.campaignId },
          select: { domain: true },
        });
      }
      if (cam?.domain) domain = cam.domain;
    } catch {
      // best effort
    }

    await this.requestQualityValidation(
      { id: updated.id, data: updated.data, templateId: updated.templateId },
      domain,
      user,
    );

    // 5. Publish resubmission event
    await this.publishSubmittedEvent(updated, user);

    console.log(
      `[SubmissionService] Submission ${id} data updated and resubmitted by ${user.email} (version ${updated.version})`,
    );

    return { data: updated as unknown as SubmissionEntity };
  }

  async findAll(
    user: AuthenticatedUser,
    query: PaginationQuery & {
      campaignId?: string;
      domain?: string;
      status?: string;
      agent?: string;
      scope?: string;
    },
  ): Promise<PaginatedResponse<SubmissionEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where = await this.buildFilter(user, query);

    const [data, total] = await Promise.all([
      (this.prisma as any).submission.findMany({
        where,
        skip,
        take: limit,
        orderBy: { submittedAt: 'desc' },
      }),
      (this.prisma as any).submission.count({ where }),
    ]);

    // Enrich with campaign info (name + domain)
    const campaignIds = [...new Set(data.map((s: any) => s.campaignId).filter(Boolean))];
    let campaignMap: Record<string, { name: unknown; domain: string }> = {};
    if (campaignIds.length > 0) {
      try {
        const campaigns = await (this.prisma as any).collectionCampaign.findMany({
          where: { id: { in: campaignIds } },
          select: { id: true, name: true, domain: true },
        });
        for (const c of campaigns) {
          campaignMap[c.id] = { name: c.name, domain: c.domain };
        }
      } catch {
        // Campaign table may not exist or FK missing — skip enrichment
      }
    }

    // Enrich with submitter name
    const submitterIds = [...new Set(data.map((s: any) => s.submittedBy).filter(Boolean))];
    let submitterMap: Record<string, string> = {};
    if (submitterIds.length > 0) {
      try {
        const users: any[] = await (this.prisma as any).$queryRawUnsafe(
          `SELECT id, first_name || ' ' || last_name AS display_name FROM public.users WHERE id = ANY($1::uuid[])`,
          submitterIds,
        );
        for (const u of users) {
          submitterMap[u.id] = u.display_name;
        }
      } catch {
        // Cross-schema query failed — return without user names
      }
    }

    // Enrich with the tenant (country or REC) where the data was collected
    const tenantIds = [...new Set(data.map((s: any) => s.tenantId).filter(Boolean))] as string[];
    const tenantMap: Record<string, { name: string; code: string | null; level: string }> = {};
    if (tenantIds.length > 0) {
      try {
        const tenants = await (this.prisma as any).tenant.findMany({
          where: { id: { in: tenantIds } },
          select: { id: true, name: true, code: true, level: true },
        });
        for (const t of tenants) tenantMap[t.id] = { name: t.name, code: t.code ?? null, level: String(t.level) };
      } catch {
        // Tenant table unavailable — return without tenant names
      }
    }

    const enriched = data.map((s: any) => {
      const campaign = campaignMap[s.campaignId];
      const tenant = tenantMap[s.tenantId];
      return {
        ...s,
        campaignName: campaign?.name ?? null,
        domain: campaign?.domain ?? null,
        submittedByName: submitterMap[s.submittedBy] ?? null,
        tenantName: tenant?.name ?? null,
        tenantCode: tenant?.code ?? null,
        tenantLevel: tenant?.level ?? null,
      };
    });

    return {
      data: enriched as unknown as SubmissionEntity[],
      meta: { total, page, limit },
    };
  }

  /**
   * Every visible submission of a campaign in one call, for dashboards.
   * Same visibility rules as findAll; names of places, agents, tenants and
   * form options are returned once in lookup tables instead of per row.
   */
  /**
   * Duplicate review of a campaign (read-only): exact copies by the same collector, clusters of probable
   * duplicates under the form rule, and the marks already set on fiches. Rejected fiches are left out.
   */
  async campaignDuplicates(user: AuthenticatedUser, campaignId: string) {
    const where = await this.buildFilter(user, { campaignId });
    const subs: any[] = await (this.prisma as any).submission.findMany({
      where,
      select: { id: true, tenantId: true, templateId: true, submittedBy: true, submittedAt: true, status: true, data: true, duplicateStatus: true, duplicateInfo: true },
      orderBy: { submittedAt: 'asc' },
    });
    const live = subs.filter((s) => String(s.status) !== 'REJECTED').map((s) => ({
      id: s.id, tenantId: s.tenantId, submittedBy: s.submittedBy, submittedAt: s.submittedAt, status: String(s.status),
      data: (s.data && typeof s.data === 'object' ? s.data : {}) as Record<string, unknown>, duplicateStatus: s.duplicateStatus,
    }));
    const rule = await this.duplicates.ruleFor(subs[0]?.templateId);
    const { exact, probable } = await this.duplicates.campaignGroups(live, rule);
    const marks: Record<string, { status: string; kind?: string; reason?: string; source?: string; reviewReason?: string }> = {};
    for (const s of subs) {
      if (!s.duplicateStatus) continue;
      const info = (s.duplicateInfo ?? {}) as DuplicateInfo;
      marks[s.id] = { status: s.duplicateStatus, kind: info.kind, reason: info.reason, source: info.source, reviewReason: info.reviewReason };
    }
    return { data: { rule, exact, probable, marks, checked: live.length } };
  }

  /** Reviewer decision on a flagged fiche: it is a different herd/entity (the duplicate mark is cleared). */
  async markNotDuplicate(id: string, reason: string | undefined, user: AuthenticatedUser) {
    const where = await this.buildFilter(user, {});
    const sub = await (this.prisma as any).submission.findFirst({ where: { ...where, id } });
    if (!sub) throw new HttpError(404, `Submission ${id} not found`);
    const prev = (sub.duplicateInfo ?? {}) as DuplicateInfo;
    const info = { ...prev, reviewedBy: user.userId, reviewedAt: new Date().toISOString(), reviewReason: reason?.trim() || undefined };
    // Only the duplicate fields change: data, status and validation history stay as they are.
    const updated = await (this.prisma as any).submission.update({
      where: { id },
      data: { duplicateStatus: 'DISTINCT', duplicateInfo: info as Prisma.InputJsonValue },
      select: { id: true, duplicateStatus: true, duplicateInfo: true },
    });
    if (this.auditor) {
      await this.auditor('DUPLICATE_DISTINCT', id, user, reason ?? null,
        { duplicateStatus: sub.duplicateStatus }, { duplicateStatus: 'DISTINCT' }, sub.dataClassification).catch(() => undefined);
    }
    return { data: updated };
  }

  async campaignDataset(user: AuthenticatedUser, campaignId: string): Promise<ApiResponse<CampaignDataset>> {
    const where = await this.buildFilter(user, { campaignId });
    const subs: Array<{ id: string; tenantId: string; templateId: string; submittedBy: string; submittedAt: Date; status: string; data: unknown }> =
      await (this.prisma as any).submission.findMany({
        where,
        select: { id: true, tenantId: true, templateId: true, submittedBy: true, submittedAt: true, status: true, data: true },
        orderBy: { submittedAt: 'asc' },
      });

    const rows: CampaignDatasetRow[] = subs.map((s) => ({
      id: s.id,
      tenantId: s.tenantId,
      submittedBy: s.submittedBy,
      submittedAt: s.submittedAt.toISOString(),
      status: String(s.status),
      data: (s.data && typeof s.data === 'object' ? s.data : {}) as Record<string, unknown>,
    }));

    // Geo IDs referenced by admin-location values ({ level_0: 'RW', level_1: uuid, ... })
    const geoIds = new Set<string>();
    for (const r of rows) {
      for (const v of Object.values(r.data)) {
        if (!v || typeof v !== 'object' || Array.isArray(v) || !('level_1' in v)) continue;
        for (const id of Object.values(v as Record<string, unknown>)) {
          if (typeof id === 'string' && UUID_RE.test(id)) geoIds.add(id);
        }
      }
    }

    const geo: CampaignDataset['geo'] = {};
    const agents: Record<string, string> = {};
    const tenants: CampaignDataset['tenants'] = {};
    const fields: CampaignDataset['fields'] = {};

    const userIds = [...new Set(rows.map((r) => r.submittedBy))];
    const tenantIds = [...new Set(rows.map((r) => r.tenantId))];
    const templateIds = [...new Set(subs.map((s) => s.templateId))];

    await Promise.all([
      geoIds.size === 0 ? null : (this.prisma as any).$queryRawUnsafe(
        `SELECT id, name_en, name_fr, level::text AS level, parent_id, country_code FROM public.geo_entities WHERE id = ANY($1::uuid[])`,
        [...geoIds],
      ).then((list: any[]) => {
        for (const g of list) {
          geo[g.id] = { en: g.name_en, fr: g.name_fr || g.name_en, level: g.level, parentId: g.parent_id, countryCode: g.country_code };
        }
      }).catch(() => undefined),
      userIds.length === 0 ? null : (this.prisma as any).$queryRawUnsafe(
        `SELECT id, first_name || ' ' || last_name AS display_name FROM public.users WHERE id = ANY($1::uuid[])`,
        userIds,
      ).then((list: any[]) => { for (const u of list) agents[u.id] = u.display_name; }).catch(() => undefined),
      tenantIds.length === 0 ? null : (this.prisma as any).tenant.findMany({
        where: { id: { in: tenantIds } },
        select: { id: true, name: true, code: true, level: true },
      }).then((list: any[]) => {
        for (const t of list) tenants[t.id] = { name: t.name, code: t.code ?? null, level: String(t.level) };
      }).catch(() => undefined),
      templateIds.length === 0 ? null : (this.prisma as any).formTemplate.findMany({
        where: { id: { in: templateIds } },
        select: { schema: true },
      }).then((list: any[]) => {
        for (const t of list) collectFieldDictionary(t.schema, fields);
      }).catch(() => undefined),
    ]);

    return {
      data: { rows, geo, agents, tenants, fields, generatedAt: new Date().toISOString() },
    };
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<SubmissionEntity>> {
    const submission = await (this.prisma as any).submission.findUnique({
      where: { id },
    });

    if (!submission) {
      throw new HttpError(404, `Submission ${id} not found`);
    }

    // Tenant isolation (a REC also sees its member countries)
    if (!(await this.canSeeTenant(user, submission.tenantId))) {
      throw new HttpError(404, `Submission ${id} not found`);
    }

    // Enrich with submittedByName and campaignName
    let submittedByName: string | null = null;
    let campaignName: unknown = null;
    try {
      if (submission.submittedBy) {
        const users: any[] = await (this.prisma as any).$queryRawUnsafe(
          `SELECT first_name || ' ' || last_name AS display_name FROM public.users WHERE id = $1::uuid`,
          submission.submittedBy,
        );
        if (users[0]) submittedByName = users[0].display_name;
      }
    } catch { /* cross-schema query may fail */ }
    try {
      if (submission.campaignId) {
        const campaign = await (this.prisma as any).collectionCampaign.findUnique({
          where: { id: submission.campaignId },
          select: { name: true },
        });
        if (campaign) campaignName = campaign.name;
      }
    } catch { /* table may not exist */ }

    return { data: { ...submission, submittedByName, campaignName } as unknown as SubmissionEntity };
  }

  /**
   * Validate submission data against the form template's required fields.
   * The template schema uses FormBuilder format (sections/fields), not JSON Schema.
   * We extract required fields and check that they have non-empty values.
   */
  async validateAgainstTemplate(
    templateId: string,
    data: Record<string, unknown>,
  ): Promise<{ instancePath: string; message?: string }[]> {
    try {
      const template = await (this.prisma as any).formTemplate.findUnique({
        where: { id: templateId },
        select: { schema: true },
      });

      if (!template?.schema) {
        console.warn(
          `[SubmissionService] Template ${templateId} not found — skipping validation`,
        );
        return [];
      }

      const schema = template.schema as Record<string, unknown>;

      // FormBuilder schemas have { sections: [...], settings: {...} }
      // Validate required fields from section definitions
      if (Array.isArray(schema.sections)) {
        const errors: { instancePath: string; message?: string }[] = [];
        for (const section of schema.sections as any[]) {
          if (!Array.isArray(section?.fields)) continue;
          for (const field of section.fields) {
            if (!field?.required || field.hidden) continue;
            // Skip layout-only fields
            if (['heading', 'divider', 'spacer', 'info-box'].includes(field.type)) continue;
            const val = data[field.code];
            if (val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0)) {
              const label = field.label?.en || field.label?.fr || field.code;
              errors.push({
                instancePath: `/${field.code}`,
                message: `${label} is required`,
              });
            }
          }
        }
        return errors;
      }

      // Fallback: if schema looks like JSON Schema (has "type" or "properties"), use AJV
      if (schema.type || schema.properties) {
        const validate = this.ajv.compile(schema);
        const valid = validate(data);
        if (!valid && validate.errors) {
          return validate.errors.map((e) => ({
            instancePath: e.instancePath ?? '',
            message: e.message,
          }));
        }
      }
    } catch (error) {
      console.warn(
        `[SubmissionService] Template validation skipped: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return [];
  }

  /**
   * Request quality validation asynchronously by publishing a Kafka event.
   * The data-quality service consumes this event, runs quality gates, and
   * publishes QUALITY.RECORD_VALIDATED or QUALITY.RECORD_REJECTED.
   */
  async requestQualityValidation(
    submission: { id: string; data: unknown; templateId: string },
    domain: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    if (!this.kafkaProducer) return;

    const headers: KafkaHeaders = {
      correlationId: uuidv4(),
      sourceService: SERVICE_NAME,
      tenantId: user.tenantId,
      userId: user.userId,
      schemaVersion: '1',
      timestamp: new Date().toISOString(),
    };
    // Audit metadata required by the AUDITABILITY gate. Collecte owns these,
    // not the form, so fill them in when the form doesn't provide them.
    const record = {
      sourceSystem: 'ARIS-collecte',
      responsibleUnit: user.tenantId,
      validationStatus: 'SUBMITTED',
      ...((submission.data ?? {}) as Record<string, unknown>),
    };
    // data-quality reads these fields directly from the message value
    const payload = {
      recordId: submission.id,
      entityType: 'Submission',
      domain,
      record,
      tenantId: user.tenantId,
      userId: user.userId,
    };

    try {
      // 5s timeout: never block the submission on Kafka
      await Promise.race([
        this.kafkaProducer.send(EVENTS.QUALITY.VALIDATION_REQUESTED, submission.id, payload, headers),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Kafka publish timeout (5s)')), 5000)),
      ]);
      console.log(
        `[SubmissionService] Quality validation requested for submission ${submission.id} via Kafka`,
      );
    } catch (error) {
      console.error(
        `[SubmissionService] Failed to publish quality validation request for ${submission.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Handle quality validation result from data-quality service (via Kafka).
   * Updates submission status and triggers workflow creation if quality passed.
   */
  async handleQualityResult(
    submissionId: string,
    reportId: string,
    overallStatus: string,
  ): Promise<void> {
    // Advisory mode: quality gates only attach their report to the submission.
    // The status is decided by the human validator on the Validation page.
    const res = await (this.prisma as any).submission.updateMany({
      where: { id: submissionId },
      data: { qualityReportId: reportId },
    });
    if (res.count === 0) {
      console.warn(`[SubmissionService] Quality report ${reportId} for unknown submission ${submissionId}`);
      return;
    }
    console.log(
      `[SubmissionService] Quality report ${reportId} (${overallStatus}) attached to submission ${submissionId}`,
    );
  }

  /**
   * Handle workflow instance created callback (via Kafka).
   * Updates submission with the workflow instance ID.
   */
  async handleWorkflowCreated(
    submissionId: string,
    workflowInstanceId: string,
  ): Promise<void> {
    await (this.prisma as any).submission.update({
      where: { id: submissionId },
      data: { workflowInstanceId },
    });
    console.log(
      `[SubmissionService] Workflow instance ${workflowInstanceId} linked to submission ${submissionId}`,
    );
  }

  /**
   * Set up Kafka consumers for quality and workflow events.
   * Called during app startup from app.ts.
   */
  async setupEventConsumers(): Promise<void> {
    if (!this.kafka) return;

    try {
      await this.kafka.subscribe(
        { topic: EVENTS.QUALITY.RECORD_VALIDATED, groupId: 'collecte-quality-validated-consumer' },
        async (payload) => {
          const { recordId, reportId, overallStatus } = payload as {
            recordId: string; reportId: string; overallStatus: string;
          };
          if (!recordId || !reportId) return;
          await this.handleQualityResult(recordId, reportId, overallStatus);
        },
      );

      await this.kafka.subscribe(
        { topic: EVENTS.QUALITY.RECORD_REJECTED, groupId: 'collecte-quality-rejected-consumer' },
        async (payload) => {
          const { recordId, reportId, overallStatus } = payload as {
            recordId: string; reportId: string; overallStatus: string;
          };
          if (!recordId || !reportId) return;
          await this.handleQualityResult(recordId, reportId, overallStatus);
        },
      );

      await this.kafka.subscribe(
        { topic: EVENTS.WORKFLOW.INSTANCE_CREATED, groupId: 'collecte-workflow-created-consumer' },
        async (payload) => {
          const event = payload as unknown as WorkflowInstanceCreatedEvent;
          const { entityId, instanceId, entityType } = event.payload;

          // Only handle Submission entities
          if (entityType !== 'Submission') return;

          console.log(
            `[CollecteEventConsumer] Workflow instance ${instanceId} created for submission ${entityId}`,
          );
          await this.handleWorkflowCreated(entityId, instanceId);
        },
      );

      console.log(
        '[CollecteEventConsumer] Subscribed to quality validated/rejected and workflow created events',
      );
    } catch (error) {
      console.warn(
        `[CollecteEventConsumer] Kafka consumers not available — async callbacks disabled: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * List submissions with conflict status (PENDING resolution).
   */
  async findConflicts(
    user: AuthenticatedUser,
    query: PaginationQuery,
  ): Promise<PaginatedResponse<SubmissionEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      conflictStatus: 'PENDING',
    };

    if (user.tenantLevel !== TenantLevel.CONTINENTAL) {
      where['tenantId'] = user.tenantId;
    }

    const [data, total] = await Promise.all([
      (this.prisma as any).submission.findMany({
        where,
        skip,
        take: limit,
        orderBy: { conflictDetectedAt: 'desc' },
      }),
      (this.prisma as any).submission.count({ where }),
    ]);

    return {
      data: data as unknown as SubmissionEntity[],
      meta: { total, page, limit },
    };
  }

  /**
   * Resolve a sync conflict on a submission.
   *
   * - KEEP_SERVER: Clear conflict flag, keep current server data.
   * - KEEP_CLIENT: Replace data with the stored client version.
   * - MERGE: Replace data with the provided mergedData.
   */
  async resolveConflict(
    id: string,
    dto: {
      resolution: 'KEEP_SERVER' | 'KEEP_CLIENT' | 'MERGE';
      mergedData?: Record<string, unknown>;
    },
    user: AuthenticatedUser,
  ): Promise<ApiResponse<SubmissionEntity>> {
    const submission = await (this.prisma as any).submission.findUnique({
      where: { id },
    });

    if (!submission) {
      throw new HttpError(404, `Submission ${id} not found`);
    }

    // Tenant isolation (a REC also sees its member countries)
    if (!(await this.canSeeTenant(user, submission.tenantId))) {
      throw new HttpError(404, `Submission ${id} not found`);
    }

    if (submission.conflictStatus !== 'PENDING') {
      throw new HttpError(400, `Submission ${id} has no pending conflict`);
    }

    // Authorization: admin roles only
    const isAdmin = ['SUPER_ADMIN', 'CONTINENTAL_ADMIN', 'REC_ADMIN', 'NATIONAL_ADMIN', 'DATA_STEWARD'].includes(user.role);
    if (!isAdmin) {
      throw new HttpError(403, 'Not authorized to resolve conflicts');
    }

    const updateData: Record<string, unknown> = {
      status: 'SUBMITTED', // Reset to SUBMITTED for re-processing
      conflictStatus: 'RESOLVED',
      conflictResolvedAt: new Date(),
      conflictResolvedBy: user.userId,
      version: { increment: 1 },
    };

    if (dto.resolution === 'KEEP_CLIENT') {
      if (!submission.conflictClientData) {
        throw new HttpError(400, 'No client data available for this conflict');
      }
      updateData['data'] = submission.conflictClientData;
    } else if (dto.resolution === 'MERGE') {
      if (!dto.mergedData) {
        throw new HttpError(400, 'mergedData is required for MERGE resolution');
      }
      updateData['data'] = dto.mergedData as any;
    }
    // KEEP_SERVER: no data change needed

    const updated = await (this.prisma as any).submission.update({
      where: { id },
      data: updateData,
    });

    console.log(
      `[SubmissionService] Conflict resolved for submission ${id}: ${dto.resolution} by ${user.email}`,
    );

    return { data: updated as unknown as SubmissionEntity };
  }

  /**
   * Check if user can access a CollectionCampaign (owner, targeted country, or targeted REC).
   * Mirrors WorkflowEngineService.canAccessCampaign logic.
   */
  private async canAccessCollectionCampaign(
    user: AuthenticatedUser,
    campaign: { ownerId: string | null; targetCountries: unknown; targetRecIds: unknown; excludedCountries?: unknown; excludedRecIds?: unknown },
  ): Promise<boolean> {
    if (campaign.ownerId === user.tenantId) return true;

    const tenant = await (this.prisma as any).tenant.findUnique({
      where: { id: user.tenantId },
      select: { level: true, countryCode: true },
    });
    if (!tenant) return false;

    const targetCountries = Array.isArray(campaign.targetCountries)
      ? (campaign.targetCountries as string[]).map((c: string) => c.toUpperCase())
      : [];
    const targetRecIds = Array.isArray(campaign.targetRecIds)
      ? (campaign.targetRecIds as string[])
      : [];
    const excludedCountries = Array.isArray(campaign.excludedCountries)
      ? (campaign.excludedCountries as string[]).map((c: string) => c.toUpperCase())
      : [];
    const excludedRecIds = Array.isArray(campaign.excludedRecIds)
      ? (campaign.excludedRecIds as string[])
      : [];

    if (tenant.level === 'MEMBER_STATE' && tenant.countryCode) {
      const cc = tenant.countryCode.toUpperCase();
      if (!targetCountries.includes(cc)) return false;
      if (excludedCountries.includes(cc)) return false;
      return true;
    }

    if (tenant.level === 'REC') {
      if (targetRecIds.includes(user.tenantId)) {
        if (excludedRecIds.includes(user.tenantId)) return false;
        return true;
      }
      const memberTenants = await (this.prisma as any).tenant.findMany({
        where: { parentId: user.tenantId, level: 'MEMBER_STATE' },
        select: { countryCode: true },
      });
      const memberCodes: string[] = memberTenants
        .map((t: { countryCode: string | null }) => t.countryCode?.toUpperCase())
        .filter(Boolean);
      return targetCountries.some((c: string) => memberCodes.includes(c) && !excludedCountries.includes(c));
    }

    return false;
  }

  /** Roles that see every submission of their tenant (a REC also sees its member countries). */
  private hasTenantWideRole(user: AuthenticatedUser): boolean {
    const roles = new Set([user.role as string, ...(user.roles ?? [])]);
    return ['SUPER_ADMIN', 'CONTINENTAL_ADMIN', 'REC_ADMIN', 'NATIONAL_ADMIN'].some((r) => roles.has(r));
  }

  /**
   * Tenants whose submissions the user may see: null = all (continental),
   * a REC = itself + its member countries, a country = itself.
   */
  private async tenantScopeIds(user: AuthenticatedUser): Promise<string[] | null> {
    if (user.tenantLevel === TenantLevel.CONTINENTAL) return null;
    if (user.tenantLevel === TenantLevel.REC) {
      try {
        const children = await (this.prisma as any).tenant.findMany({
          where: { parentId: user.tenantId },
          select: { id: true },
        });
        return [user.tenantId, ...children.map((c: { id: string }) => c.id)];
      } catch {
        return [user.tenantId];
      }
    }
    return [user.tenantId];
  }

  private async canSeeTenant(user: AuthenticatedUser, tenantId: string): Promise<boolean> {
    const ids = await this.tenantScopeIds(user);
    return ids === null || ids.includes(tenantId);
  }

  private async buildFilter(
    user: AuthenticatedUser,
    query: { campaignId?: string; domain?: string; status?: string; agent?: string; scope?: string },
  ): Promise<Record<string, unknown>> {
    const where: Record<string, unknown> = {};

    const scopeIds = await this.tenantScopeIds(user);
    if (scopeIds) {
      where['tenantId'] = scopeIds.length === 1 ? scopeIds[0] : { in: scopeIds };
    }

    if (query.campaignId) {
      where['campaignId'] = query.campaignId;
    } else if (query.domain) {
      // Look up all campaign IDs for this domain
      try {
        const domainCampaigns = await (this.prisma as any).collectionCampaign.findMany({
          where: { domain: query.domain },
          select: { id: true },
        });
        const ids = domainCampaigns.map((c: { id: string }) => c.id);
        if (ids.length > 0) {
          where['campaignId'] = { in: ids };
        } else {
          // No campaigns for this domain — return empty result
          where['id'] = { in: [] };
        }
      } catch {
        // CollectionCampaign table may not exist — fall back to no filter
      }
    }
    if (query.status) where['status'] = query.status;

    // When agent is specified, filter by user visibility:
    //   scope=toReview → only submissions from users assigned to this agent for validation
    //   scope=mine     → only the agent's own submissions
    //   scope=all (default) → both own + assigned users' submissions
    const seesWholeTenant = query.agent === user.userId
      && (query.scope ?? 'all') === 'all'
      && this.hasTenantWideRole(user);
    if (query.agent && !seesWholeTenant) {
      let assignedUserIds: string[] = [];
      try {
        const chains = await (this.prisma as any).collecteValidationChain.findMany({
          where: { validatorId: query.agent, isActive: true },
          select: { userId: true },
        });
        assignedUserIds = chains.map((c: { userId: string }) => c.userId);
      } catch {
        // Table may not exist — fall back to own submissions only
      }

      const scope = query.scope || 'all';
      if (scope === 'toReview') {
        // Only submissions from assigned users (exclude own)
        if (assignedUserIds.length > 0) {
          where['submittedBy'] = { in: assignedUserIds };
        } else {
          // No one assigned → empty result
          where['id'] = { in: [] };
        }
      } else if (scope === 'mine') {
        // Only own submissions
        where['submittedBy'] = query.agent;
      } else {
        // all: own + assigned
        const submitterIds = [query.agent, ...assignedUserIds];
        where['submittedBy'] = { in: submitterIds };
      }
    }

    // Access-level filtering: exclude submissions from hidden campaigns
    const isAdmin = ADMIN_BYPASS_ROLES.includes(user.role as any);
    if (isAccessLevelsEnabled() && !isAdmin) {
      try {
        const userScopes = await this.getUserAccessContext(user.userId);
        const userNodeCodes = Object.keys(user.domains ?? {});
        const assignedIds = await (this.prisma as any).campaignAssignment.findMany({
          where: { userId: user.userId },
          select: { campaignId: true },
        }).then((rows: Array<{ campaignId: string }>) => rows.map((r) => r.campaignId));

        const allScopes = await (this.prisma as any).campaignScopeAccessLevel.findMany({
          select: { campaignId: true, nodeCode: true, levelCode: true },
        });
        const scopesByCampaign: Record<string, CampaignScopes> = {};
        for (const row of allScopes) {
          if (!scopesByCampaign[row.campaignId]) scopesByCampaign[row.campaignId] = {};
          if (!scopesByCampaign[row.campaignId][row.nodeCode]) scopesByCampaign[row.campaignId][row.nodeCode] = [];
          scopesByCampaign[row.campaignId][row.nodeCode].push(row.levelCode);
        }

        const hiddenIds: string[] = [];
        for (const [campaignId, scopes] of Object.entries(scopesByCampaign)) {
          if (assignedIds.includes(campaignId)) continue;
          const input: VisibilityInput = {
            userNodeCodes, userScopes, campaignScopes: scopes,
            options: { userRole: user.role as any, isAssignedAgent: false, featureEnabled: true },
          };
          if (!canViewCampaign(input)) hiddenIds.push(campaignId);
        }

        if (hiddenIds.length > 0) {
          if (where['campaignId'] && typeof where['campaignId'] === 'string') {
            // Single campaign filter — block if hidden
            if (hiddenIds.includes(where['campaignId'] as string)) {
              where['id'] = { in: [] };
            }
          } else {
            where['NOT'] = { ...(where['NOT'] as Record<string, unknown> ?? {}), campaignId: { in: hiddenIds } };
          }
        }
      } catch { /* access-level filtering is best-effort */ }
    }

    return where;
  }

  private async getUserAccessContext(userId: string): Promise<Record<string, string[]>> {
    try {
      const rows = await (this.prisma as any).userScopeAccessLevel.findMany({ where: { userId } });
      const scopes: Record<string, string[]> = {};
      for (const row of rows) {
        if (!scopes[row.nodeCode]) scopes[row.nodeCode] = [];
        scopes[row.nodeCode].push(row.levelCode);
      }
      return scopes;
    } catch { return {}; }
  }

  private async publishSubmittedEvent(
    submission: unknown,
    user: AuthenticatedUser,
  ): Promise<void> {
    const s = submission as SubmissionEntity;
    const headers: KafkaHeaders = {
      correlationId: uuidv4(),
      sourceService: SERVICE_NAME,
      tenantId: user.tenantId,
      userId: user.userId,
      schemaVersion: '1',
      timestamp: new Date().toISOString(),
    };

    const payload = {
      submissionId: s.id,
      campaignId: s.campaignId,
      templateId: s.templateId,
      submittedBy: s.submittedBy,
      submittedAt: s.submittedAt,
      deviceId: s.deviceId,
      domain: undefined as string | undefined,
    };

    // Load campaign domain for the event (try CollectionCampaign first, then legacy)
    try {
      let cam = await (this.prisma as any).collectionCampaign.findUnique({
        where: { id: s.campaignId },
        select: { domain: true },
      });
      if (!cam) {
        cam = await (this.prisma as any).campaign.findUnique({
          where: { id: s.campaignId },
          select: { domain: true },
        });
      }
      payload.domain = cam?.domain;
    } catch {
      // Best effort
    }

    try {
      await this.kafkaProducer.send(
        TOPIC_MS_COLLECTE_FORM_SUBMITTED,
        s.id,
        payload,
        headers,
      );
    } catch (error) {
      console.error(
        `[SubmissionService] Failed to publish submission event for ${s.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Send in-app notification to kit_recipient when form data includes a user-select field.
   * Non-blocking: errors are logged but don't fail the submission.
   */
  private async sendRecipientNotification(
    submission: { id: string; campaignId: string; data: unknown },
    formData: Record<string, unknown>,
    submitter: AuthenticatedUser,
  ): Promise<void> {
    const recipientUserId = formData.kit_recipient as string | undefined;
    if (!recipientUserId || typeof recipientUserId !== 'string') return;

    try {
      const country = formData.destination_country;
      const countryName = typeof country === 'object' && country
        ? (country as Record<string, string>).level_0 || 'your country'
        : String(country || 'your country');
      const kitFormat = formData.kit_format || '';
      const quantity = formData.quantity || '';
      const shipmentNum = formData.shipment_number || '';

      // Create in-app notification via direct DB insert (message service may not be reachable)
      await (this.prisma as any).$executeRawUnsafe(
        `INSERT INTO public.notifications (id, tenant_id, user_id, channel, subject, body, status, metadata, sent_at, created_at, updated_at)
         VALUES (gen_random_uuid(), COALESCE((SELECT tenant_id FROM public.users WHERE id = $2::uuid), $1::uuid), $2::uuid, 'IN_APP', $3, $4, 'SENT', $5::jsonb, NOW(), NOW(), NOW())
         ON CONFLICT DO NOTHING`,
        submitter.tenantId,
        recipientUserId,
        'PPR Kit Shipment — Please confirm reception',
        `PPR diagnostic kits (${kitFormat}, qty: ${quantity}) have been shipped to ${countryName}. Shipment #${shipmentNum}. Please confirm reception in the Collecte module.`,
        JSON.stringify({
          submissionId: submission.id,
          campaignId: submission.campaignId,
          action: 'confirm_kit_reception',
        }),
      );

      console.log(
        `[SubmissionService] Kit notification sent to user ${recipientUserId} for submission ${submission.id}`,
      );
    } catch (error) {
      console.warn(
        `[SubmissionService] Failed to send kit notification: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}


/** 409 carrying the matching fiches so the client can show them. */
function duplicateError(status: number, code: string, message: string, candidates: DuplicateCandidate[], action: 'warn' | 'block' | null): HttpError {
  const err = new HttpError(status, message);
  (err as any).duplicate = { code, action, candidates };
  return err;
}

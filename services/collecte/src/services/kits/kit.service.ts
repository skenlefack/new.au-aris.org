/**
 * PANVAC kit requests: country request -> PANVAC decision -> shipments -> reception by the country.
 *
 * Requests come from the request form of a campaign whose metadata.module = 'panvac_kits'
 * (one kit_requests row per submission, created by ingest()). The PANVAC decision, the shipments
 * and the receptions live in kit_requests / kit_shipments, with every action in kit_request_events.
 * Notifications are written to public.notifications (in-app), in the user's language.
 */
import type { PrismaClient } from '@prisma/client';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { TenantLevel } from '@aris/shared-types';
import { HttpError } from '../submission.service';
import {
  deriveMetrics, DECISION_SLA_DAYS,
  type DecisionStatus, type KitRequestRow, type KitShipmentRow, type KitRequestMetrics,
} from './kit-metrics';

export const KIT_MODULE = 'panvac_kits';
const PANVAC_FUNCTION = 'PANVAC_FOCAL_POINT';
const PANVAC_ROLES = new Set(['SUPER_ADMIN', 'CONTINENTAL_ADMIN']);
const COUNTRY_CONFIRM_ROLES = new Set(['NATIONAL_ADMIN', 'DATA_STEWARD']);
const SAMPLES_PER_KIT: Record<string, number> = { F10: 880, F20: 1760 };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface DecisionInput {
  decision: 'APPROVE' | 'REJECT';
  quantityApproved?: number;
  availableFrom?: string;
  availableTo?: string;
  comment?: string;
}
export interface ShipmentInput {
  shippedAt: string;
  quantity: number;
  kitFormat?: string;
  numSamples?: number;
  lotNumber?: string;
  expiryDate?: string;
  waybill?: string;
  carrier?: string;
  comment?: string;
}
export interface ReceptionInput {
  receivedAt: string;
  quantityReceived: number;
  condition: 'GOOD' | 'DAMAGED' | 'INCOMPLETE';
  comment?: string;
}

interface Msg { subject: string; body: string }

const day = (v: unknown): string | null => {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
};
const iso = (v: unknown): string | null => (v ? (v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString()) : null);

export class KitService {
  private panvacCache = new Map<string, { at: number; value: boolean }>();

  constructor(private readonly prisma: PrismaClient) {}

  private get db(): any { return this.prisma as any; }

  /* ── Access ── */

  async isPanvac(user: AuthenticatedUser): Promise<boolean> {
    if (PANVAC_ROLES.has(user.role) || (user.roles ?? []).some((r) => PANVAC_ROLES.has(r))) return true;
    const hit = this.panvacCache.get(user.userId);
    if (hit && Date.now() - hit.at < 60_000) return hit.value;
    const rows: any[] = await this.db.$queryRawUnsafe(
      `SELECT 1 FROM governance.user_functions uf JOIN governance.functions f ON f.id = uf.function_id
        WHERE uf.user_id = $1::uuid AND f.code = $2 AND (uf.end_date IS NULL OR uf.end_date > now()) LIMIT 1`,
      user.userId, PANVAC_FUNCTION,
    ).catch(() => []);
    const value = rows.length > 0;
    this.panvacCache.set(user.userId, { at: Date.now(), value });
    return value;
  }

  /** Tenants whose requests the user may see; null = all (continental level or PANVAC). */
  private async scopeTenantIds(user: AuthenticatedUser): Promise<string[] | null> {
    if (user.tenantLevel === TenantLevel.CONTINENTAL || (await this.isPanvac(user))) return null;
    if (user.tenantLevel === TenantLevel.REC) {
      const kids: any[] = await this.db.tenant.findMany({ where: { parentId: user.tenantId }, select: { id: true } }).catch(() => []);
      return [user.tenantId, ...kids.map((k) => k.id)];
    }
    return [user.tenantId];
  }

  private async assertModuleCampaign(campaignId: string): Promise<void> {
    const rows: any[] = await this.db.$queryRawUnsafe(
      `SELECT metadata->>'module' AS module FROM public.collection_campaigns WHERE id = $1::uuid`, campaignId,
    );
    if (!rows.length) throw new HttpError(404, `Campaign ${campaignId} not found`);
    if (rows[0].module !== KIT_MODULE) throw new HttpError(400, 'This campaign does not manage PANVAC kit requests');
  }

  async isModuleCampaign(campaignId: string): Promise<boolean> {
    const rows: any[] = await this.db.$queryRawUnsafe(
      `SELECT 1 FROM public.collection_campaigns WHERE id = $1::uuid AND metadata->>'module' = $2`, campaignId, KIT_MODULE,
    ).catch(() => []);
    return rows.length > 0;
  }

  /* ── Requests from form submissions ── */

  /**
   * Creates the kit_requests rows for request-form submissions (all of a campaign, or one submission).
   * A request not yet decided follows edits of its submission; a rejected submission cancels it.
   * New requests notify the PANVAC focal points.
   */
  async ingest(campaignId: string, submissionId?: string): Promise<void> {
    const inserted: any[] = await this.db.$queryRawUnsafe(
      `INSERT INTO public.kit_requests (campaign_id, submission_id, tenant_id, country_code, product, kit_format,
              quantity_requested, desired_date, requested_at, requested_by, recipient_id)
       SELECT s.campaign_id, s.id, s.tenant_id,
              upper(COALESCE(NULLIF(s.data->'country'->>'level_0', ''), t.code, '??')),
              NULLIF(s.data->>'product_type', ''), NULLIF(s.data->>'kit_format', ''),
              NULLIF(regexp_replace(COALESCE(s.data->>'quantity_requested', ''), '[^0-9]', '', 'g'), '')::int,
              CASE WHEN s.data->>'desired_date' ~ '^\\d{4}-\\d{2}-\\d{2}' THEN left(s.data->>'desired_date', 10)::date END,
              s.submitted_at, s.submitted_by,
              CASE WHEN s.data->>'reception_contact' ~* '^[0-9a-f-]{36}$' THEN (s.data->>'reception_contact')::uuid END
         FROM public.submissions s
         LEFT JOIN public.tenants t ON t.id = s.tenant_id
        WHERE s.campaign_id = $1::uuid AND s.status::text <> 'REJECTED'
          AND ($2::uuid IS NULL OR s.id = $2::uuid)
       ON CONFLICT (submission_id) DO UPDATE SET
              country_code = EXCLUDED.country_code, product = EXCLUDED.product, kit_format = EXCLUDED.kit_format,
              quantity_requested = EXCLUDED.quantity_requested, desired_date = EXCLUDED.desired_date,
              recipient_id = EXCLUDED.recipient_id, updated_at = now()
        WHERE public.kit_requests.status = 'SUBMITTED'
       RETURNING id, campaign_id, country_code, quantity_requested, requested_by, (xmax = 0) AS inserted`,
      campaignId, submissionId ?? null,
    );
    await this.db.$executeRawUnsafe(
      `UPDATE public.kit_requests r SET status = 'CANCELLED', updated_at = now()
        WHERE r.campaign_id = $1::uuid AND r.status = 'SUBMITTED' AND r.submission_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM public.submissions s WHERE s.id = r.submission_id AND s.status::text <> 'REJECTED')`,
      campaignId,
    );
    for (const r of inserted.filter((x) => x.inserted)) {
      await this.event(r.id, 'SUBMITTED', r.requested_by, { quantityRequested: r.quantity_requested });
      const panvac = await this.panvacUserIds();
      await this.notify(panvac, (fr) => fr
        ? { subject: `Nouvelle demande de kits — ${r.country_code}`, body: `Le pays ${r.country_code} demande ${r.quantity_requested ?? '?'} kit(s). Merci de l'examiner et de rendre votre décision sous ${DECISION_SLA_DAYS} jours.` }
        : { subject: `New kit request — ${r.country_code}`, body: `${r.country_code} requests ${r.quantity_requested ?? '?'} kit(s). Please review it and decide within ${DECISION_SLA_DAYS} days.` },
      { campaignId: r.campaign_id, requestId: r.id, action: 'kit_request_submitted' });
    }
  }

  /* ── Read ── */

  async list(user: AuthenticatedUser, campaignId: string) {
    await this.assertModuleCampaign(campaignId);
    await this.ingest(campaignId).catch((e) => console.warn(`[KitService] ingest failed: ${e instanceof Error ? e.message : e}`));
    const scope = await this.scopeTenantIds(user);
    const isPanvac = await this.isPanvac(user);

    const reqs: any[] = await this.db.$queryRawUnsafe(
      `SELECT * FROM public.kit_requests WHERE campaign_id = $1::uuid
          AND ($2::uuid[] IS NULL OR tenant_id = ANY($2::uuid[]))
        ORDER BY requested_at DESC`,
      campaignId, scope,
    );
    const ids = reqs.map((r) => r.id);
    const countries = [...new Set(reqs.map((r) => r.country_code))];
    const [ships, events]: [any[], any[]] = await Promise.all([
      // History shipments may have no request: shown with the country's requests when the viewer sees that country.
      this.db.$queryRawUnsafe(
        `SELECT * FROM public.kit_shipments WHERE campaign_id = $1::uuid
            AND (request_id = ANY($2::uuid[]) OR (request_id IS NULL AND ($3::boolean OR country_code = ANY($4::text[]))))
          ORDER BY shipped_at`,
        campaignId, ids, scope === null, countries,
      ),
      ids.length ? this.db.$queryRawUnsafe(
        `SELECT * FROM public.kit_request_events WHERE request_id = ANY($1::uuid[]) ORDER BY created_at`, ids,
      ) : [],
    ]);

    const userIds = new Set<string>();
    for (const r of reqs) [r.requested_by, r.recipient_id, r.decided_by].forEach((u) => u && userIds.add(u));
    for (const s of ships) [s.shipped_by, s.received_by].forEach((u) => u && userIds.add(u));
    for (const e of events) if (e.actor_id) userIds.add(e.actor_id);
    const names = await this.names([...userIds]);

    const shipRows = ships.map((s) => this.shipmentOut(s, names));
    const byRequest = new Map<string, typeof shipRows>();
    for (const s of shipRows) {
      if (!s.requestId) continue;
      const list = byRequest.get(s.requestId) ?? [];
      list.push(s);
      byRequest.set(s.requestId, list);
    }
    const now = new Date();
    const requests = reqs.map((r) => {
      const row = this.requestRow(r);
      const shipments = byRequest.get(r.id) ?? [];
      const metrics: KitRequestMetrics = deriveMetrics(row, shipments, now);
      const mine = r.requested_by === user.userId || r.recipient_id === user.userId;
      const countryAdmin = r.tenant_id === user.tenantId && ((COUNTRY_CONFIRM_ROLES.has(user.role)) || (user.roles ?? []).some((x) => COUNTRY_CONFIRM_ROLES.has(x)));
      return {
        id: r.id,
        submissionId: r.submission_id,
        tenantId: r.tenant_id,
        countryCode: r.country_code,
        product: r.product,
        kitFormat: r.kit_format,
        quantityRequested: r.quantity_requested,
        desiredDate: day(r.desired_date),
        requestedAt: iso(r.requested_at),
        requestedBy: r.requested_by, requestedByName: names[r.requested_by] ?? null,
        recipientId: r.recipient_id, recipientName: names[r.recipient_id] ?? null,
        status: r.status as DecisionStatus,
        quantityApproved: r.quantity_approved,
        availableFrom: day(r.available_from),
        availableTo: day(r.available_to),
        decisionComment: r.decision_comment,
        decidedBy: r.decided_by, decidedByName: names[r.decided_by] ?? null,
        decidedAt: iso(r.decided_at),
        isHistorical: r.is_historical,
        shipments,
        events: events.filter((e) => e.request_id === r.id).map((e) => ({
          action: e.action, at: iso(e.created_at), actorName: names[e.actor_id] ?? null, payload: e.payload,
        })),
        metrics,
        can: {
          decide: isPanvac && !r.is_historical && ['SUBMITTED', 'APPROVED', 'PARTIAL', 'REJECTED'].includes(r.status) && shipments.length === 0,
          ship: isPanvac && !r.is_historical && ['APPROVED', 'PARTIAL'].includes(r.status),
          confirm: !r.is_historical && (mine || countryAdmin || user.role === 'SUPER_ADMIN'),
          cancel: !r.is_historical && r.status === 'SUBMITTED' && (mine || countryAdmin),
        },
      };
    });
    const orphanShipments = shipRows.filter((s) => !s.requestId);

    return {
      data: {
        requests,
        orphanShipments,
        viewer: { userId: user.userId, isPanvac, slaDays: DECISION_SLA_DAYS },
        generatedAt: now.toISOString(),
      },
    };
  }

  /* ── PANVAC actions ── */

  async decide(user: AuthenticatedUser, requestId: string, input: DecisionInput) {
    if (!(await this.isPanvac(user))) throw new HttpError(403, 'Only PANVAC can decide on kit requests');
    const r = await this.loadRequest(requestId);
    if (r.is_historical || r.status === 'CANCELLED') throw new HttpError(409, 'This request can no longer be decided');
    const shipped: any[] = await this.db.$queryRawUnsafe(`SELECT 1 FROM public.kit_shipments WHERE request_id = $1::uuid LIMIT 1`, requestId);
    if (shipped.length) throw new HttpError(409, 'Kits have already been shipped for this request');

    let status: DecisionStatus;
    let qty: number | null = null;
    if (input.decision === 'APPROVE') {
      qty = Math.floor(Number(input.quantityApproved));
      if (!Number.isFinite(qty) || qty < 1) throw new HttpError(400, 'The approved quantity must be at least 1');
      if (!input.availableFrom || !input.availableTo) throw new HttpError(400, 'The availability period is required');
      if (input.availableTo < input.availableFrom) throw new HttpError(400, 'The availability period ends before it starts');
      status = r.quantity_requested !== null && qty < r.quantity_requested ? 'PARTIAL' : 'APPROVED';
    } else {
      if (!input.comment || input.comment.trim().length < 5) throw new HttpError(400, 'A reason is required to reject a request');
      status = 'REJECTED';
    }
    const approve = input.decision === 'APPROVE';
    await this.db.$executeRawUnsafe(
      `UPDATE public.kit_requests SET status = $2, quantity_approved = $3, available_from = $4::date, available_to = $5::date,
              decision_comment = $6, decided_by = $7::uuid, decided_at = now(), updated_at = now()
        WHERE id = $1::uuid`,
      requestId, status, qty, approve ? input.availableFrom : null, approve ? input.availableTo : null,
      input.comment?.trim() || null, user.userId,
    );
    const revised = r.status !== 'SUBMITTED';
    await this.event(requestId, revised ? 'DECISION_REVISED' : 'DECIDED', user.userId, {
      status, quantityApproved: qty, availableFrom: input.availableFrom ?? null, availableTo: input.availableTo ?? null, comment: input.comment ?? null,
    });
    const period = approve ? `${input.availableFrom} → ${input.availableTo}` : '';
    await this.notify([r.requested_by, r.recipient_id], (fr) => {
      if (status === 'REJECTED') {
        return fr
          ? { subject: 'Demande de kits non retenue', body: `Le PANVAC n'a pas retenu votre demande de ${r.quantity_requested ?? '?'} kit(s). Motif : ${input.comment}` }
          : { subject: 'Kit request not approved', body: `PANVAC did not approve your request for ${r.quantity_requested ?? '?'} kit(s). Reason: ${input.comment}` };
      }
      return fr
        ? { subject: status === 'PARTIAL' ? 'Demande de kits approuvée partiellement' : 'Demande de kits approuvée', body: `Le PANVAC met ${qty} kit(s) à disposition (demandé : ${r.quantity_requested ?? '?'}). Disponibilité prévue : ${period}.${input.comment ? ` ${input.comment}` : ''}` }
        : { subject: status === 'PARTIAL' ? 'Kit request partially approved' : 'Kit request approved', body: `PANVAC is making ${qty} kit(s) available (requested: ${r.quantity_requested ?? '?'}). Expected availability: ${period}.${input.comment ? ` ${input.comment}` : ''}` };
    }, { campaignId: r.campaign_id, requestId, action: 'kit_request_decided' });
    return { data: { id: requestId, status } };
  }

  async addShipment(user: AuthenticatedUser, requestId: string, input: ShipmentInput) {
    if (!(await this.isPanvac(user))) throw new HttpError(403, 'Only PANVAC can record shipments');
    const r = await this.loadRequest(requestId);
    if (r.is_historical || !['APPROVED', 'PARTIAL'].includes(r.status)) throw new HttpError(409, 'Kits can only be shipped for an approved request');
    const qty = Math.floor(Number(input.quantity));
    if (!Number.isFinite(qty) || qty < 1) throw new HttpError(400, 'The quantity must be at least 1');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.shippedAt)) throw new HttpError(400, 'The shipment date is required');
    const format = input.kitFormat || r.kit_format || null;
    const samples = input.numSamples ?? (format && SAMPLES_PER_KIT[format] ? SAMPLES_PER_KIT[format] * qty : null);

    const rows: any[] = await this.db.$queryRawUnsafe(
      `INSERT INTO public.kit_shipments (campaign_id, request_id, country_code, shipped_at, quantity, kit_format, num_samples,
              lot_number, expiry_date, waybill, carrier, comment, shipped_by)
       VALUES ($1::uuid, $2::uuid, $3, $4::date, $5, $6, $7, $8, $9::date, $10, $11, $12, $13::uuid) RETURNING id`,
      r.campaign_id, requestId, r.country_code, input.shippedAt, qty, format, samples,
      input.lotNumber || null, input.expiryDate || null, input.waybill || null, input.carrier || null, input.comment || null, user.userId,
    );
    await this.event(requestId, 'SHIPPED', user.userId, { shipmentId: rows[0].id, quantity: qty, shippedAt: input.shippedAt, waybill: input.waybill ?? null });
    await this.notify([r.recipient_id, r.requested_by], (fr) => fr
      ? { subject: 'Kits expédiés — merci de confirmer la réception', body: `Le PANVAC a expédié ${qty} kit(s)${format ? ` (${format})` : ''} le ${input.shippedAt}${input.waybill ? `, bordereau ${input.waybill}` : ''}. Merci de confirmer la réception dans ARIS dès leur arrivée.` }
      : { subject: 'Kits shipped — please confirm reception', body: `PANVAC shipped ${qty} kit(s)${format ? ` (${format})` : ''} on ${input.shippedAt}${input.waybill ? `, waybill ${input.waybill}` : ''}. Please confirm reception in ARIS when they arrive.` },
    { campaignId: r.campaign_id, requestId, shipmentId: rows[0].id, action: 'confirm_kit_reception' });
    return { data: { id: rows[0].id } };
  }

  async deleteShipment(user: AuthenticatedUser, shipmentId: string) {
    if (!(await this.isPanvac(user))) throw new HttpError(403, 'Only PANVAC can remove shipments');
    const s = await this.loadShipment(shipmentId);
    if (s.is_historical || s.received_at) throw new HttpError(409, 'A received or historical shipment cannot be removed');
    await this.db.$executeRawUnsafe(`DELETE FROM public.kit_shipments WHERE id = $1::uuid`, shipmentId);
    if (s.request_id) await this.event(s.request_id, 'SHIPMENT_REMOVED', user.userId, { shipmentId, quantity: s.quantity, shippedAt: day(s.shipped_at) });
    return { data: { id: shipmentId } };
  }

  /* ── Country actions ── */

  async confirmReception(user: AuthenticatedUser, shipmentId: string, input: ReceptionInput) {
    const s = await this.loadShipment(shipmentId);
    if (!s.request_id || s.is_historical) throw new HttpError(409, 'This shipment cannot be confirmed');
    if (s.received_at) throw new HttpError(409, 'Reception already confirmed');
    const r = await this.loadRequest(s.request_id);
    const roles = new Set([user.role as string, ...(user.roles ?? [])]);
    const allowed = roles.has('SUPER_ADMIN') || r.requested_by === user.userId || r.recipient_id === user.userId
      || (r.tenant_id === user.tenantId && [...COUNTRY_CONFIRM_ROLES].some((x) => roles.has(x)));
    if (!allowed) throw new HttpError(403, 'Only the requesting country can confirm reception');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.receivedAt)) throw new HttpError(400, 'The reception date is required');
    if (input.receivedAt < day(s.shipped_at)!) throw new HttpError(400, 'The reception date is before the shipment date');
    const qty = Math.floor(Number(input.quantityReceived));
    if (!Number.isFinite(qty) || qty < 0 || qty > s.quantity) throw new HttpError(400, `The quantity received must be between 0 and ${s.quantity}`);

    await this.db.$executeRawUnsafe(
      `UPDATE public.kit_shipments SET received_at = $2::date, quantity_received = $3, condition = $4, reception_comment = $5,
              received_by = $6::uuid, confirmed_at = now(), updated_at = now() WHERE id = $1::uuid`,
      shipmentId, input.receivedAt, qty, input.condition, input.comment?.trim() || null, user.userId,
    );
    await this.event(r.id, 'RECEIVED', user.userId, { shipmentId, quantityReceived: qty, receivedAt: input.receivedAt, condition: input.condition, comment: input.comment ?? null });
    const panvac = await this.panvacUserIds();
    await this.notify([...panvac, s.shipped_by], (fr) => fr
      ? { subject: `Réception confirmée — ${r.country_code}`, body: `${r.country_code} a reçu ${qty}/${s.quantity} kit(s) le ${input.receivedAt} (état : ${input.condition === 'GOOD' ? 'bon' : input.condition === 'DAMAGED' ? 'endommagé' : 'incomplet'}).${input.comment ? ` ${input.comment}` : ''}` }
      : { subject: `Reception confirmed — ${r.country_code}`, body: `${r.country_code} received ${qty}/${s.quantity} kit(s) on ${input.receivedAt} (condition: ${input.condition.toLowerCase()}).${input.comment ? ` ${input.comment}` : ''}` },
    { campaignId: r.campaign_id, requestId: r.id, shipmentId, action: 'kit_reception_confirmed' });
    return { data: { id: shipmentId } };
  }

  async cancel(user: AuthenticatedUser, requestId: string, reason?: string) {
    const r = await this.loadRequest(requestId);
    const roles = new Set([user.role as string, ...(user.roles ?? [])]);
    const allowed = r.requested_by === user.userId || r.recipient_id === user.userId
      || (r.tenant_id === user.tenantId && [...COUNTRY_CONFIRM_ROLES].some((x) => roles.has(x))) || roles.has('SUPER_ADMIN');
    if (!allowed) throw new HttpError(403, 'Only the requesting country can withdraw its request');
    if (r.status !== 'SUBMITTED') throw new HttpError(409, 'Only a request still waiting for a decision can be withdrawn');
    await this.db.$executeRawUnsafe(`UPDATE public.kit_requests SET status = 'CANCELLED', updated_at = now() WHERE id = $1::uuid`, requestId);
    await this.event(requestId, 'CANCELLED', user.userId, { reason: reason ?? null });
    return { data: { id: requestId, status: 'CANCELLED' } };
  }

  /* ── Helpers ── */

  private requestRow(r: any): KitRequestRow {
    return {
      id: r.id, countryCode: r.country_code, status: r.status, quantityRequested: r.quantity_requested,
      quantityApproved: r.quantity_approved, requestedAt: iso(r.requested_at)!, decidedAt: iso(r.decided_at),
      availableFrom: day(r.available_from), availableTo: day(r.available_to), desiredDate: day(r.desired_date),
      isHistorical: r.is_historical,
    };
  }

  private shipmentOut(s: any, names: Record<string, string>): KitShipmentRow & Record<string, unknown> {
    return {
      id: s.id, requestId: s.request_id, countryCode: s.country_code, shippedAt: day(s.shipped_at)!,
      quantity: s.quantity, kitFormat: s.kit_format, numSamples: s.num_samples,
      receivedAt: day(s.received_at), quantityReceived: s.quantity_received, condition: s.condition,
      isHistorical: s.is_historical,
      lotNumber: s.lot_number, expiryDate: day(s.expiry_date), waybill: s.waybill, carrier: s.carrier, comment: s.comment,
      receptionComment: s.reception_comment,
      shippedByName: names[s.shipped_by] ?? null, receivedByName: names[s.received_by] ?? null,
    };
  }

  private async loadRequest(id: string): Promise<any> {
    if (!UUID.test(id)) throw new HttpError(404, 'Request not found');
    const rows: any[] = await this.db.$queryRawUnsafe(`SELECT * FROM public.kit_requests WHERE id = $1::uuid`, id);
    if (!rows.length) throw new HttpError(404, 'Request not found');
    return rows[0];
  }

  private async loadShipment(id: string): Promise<any> {
    if (!UUID.test(id)) throw new HttpError(404, 'Shipment not found');
    const rows: any[] = await this.db.$queryRawUnsafe(`SELECT * FROM public.kit_shipments WHERE id = $1::uuid`, id);
    if (!rows.length) throw new HttpError(404, 'Shipment not found');
    return rows[0];
  }

  private async event(requestId: string, action: string, actorId: string | null, payload: Record<string, unknown>) {
    await this.db.$executeRawUnsafe(
      `INSERT INTO public.kit_request_events (request_id, action, actor_id, payload) VALUES ($1::uuid, $2, $3::uuid, $4::jsonb)`,
      requestId, action, actorId, JSON.stringify(payload),
    ).catch((e: unknown) => console.warn(`[KitService] event not saved: ${e instanceof Error ? e.message : e}`));
  }

  private async panvacUserIds(): Promise<string[]> {
    const rows: any[] = await this.db.$queryRawUnsafe(
      `SELECT DISTINCT u.id FROM public.users u
         JOIN governance.user_functions uf ON uf.user_id = u.id
         JOIN governance.functions f ON f.id = uf.function_id
        WHERE f.code = $1 AND u.is_active AND (uf.end_date IS NULL OR uf.end_date > now())`,
      PANVAC_FUNCTION,
    ).catch(() => []);
    return rows.map((r) => r.id);
  }

  private async names(ids: string[]): Promise<Record<string, string>> {
    const out: Record<string, string> = {};
    if (!ids.length) return out;
    const rows: any[] = await this.db.$queryRawUnsafe(
      `SELECT id, trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')) AS name FROM public.users WHERE id = ANY($1::uuid[])`, ids,
    ).catch(() => []);
    for (const r of rows) out[r.id] = r.name;
    return out;
  }

  /** In-app notifications, one per user, in French for French-speaking users and English otherwise. Never throws. */
  private async notify(userIds: Array<string | null | undefined>, msg: (fr: boolean) => Msg, metadata: Record<string, unknown>) {
    const ids = [...new Set(userIds.filter((u): u is string => !!u && UUID.test(u)))];
    if (!ids.length) return;
    try {
      const users: any[] = await this.db.$queryRawUnsafe(
        `SELECT id, tenant_id, locale FROM public.users WHERE id = ANY($1::uuid[]) AND is_active`, ids,
      );
      const link = metadata.campaignId ? `/collecte/campaigns/${metadata.campaignId}?tab=kits${metadata.requestId ? `&request=${metadata.requestId}` : ''}` : undefined;
      for (const u of users) {
        const m = msg(String(u.locale ?? '').toLowerCase().startsWith('fr'));
        await this.db.$executeRawUnsafe(
          `INSERT INTO public.notifications (id, tenant_id, user_id, channel, subject, body, status, metadata, sent_at, created_at, updated_at)
           VALUES (gen_random_uuid(), $1::uuid, $2::uuid, 'IN_APP', $3, $4, 'SENT', $5::jsonb, now(), now(), now())`,
          u.tenant_id, u.id, m.subject.slice(0, 500), m.body, JSON.stringify({ ...metadata, link, type: 'workflow' }),
        );
      }
    } catch (e) {
      console.warn(`[KitService] notification failed: ${e instanceof Error ? e.message : e}`);
    }
  }
}

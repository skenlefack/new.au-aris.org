import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import {
  TenantLevel,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  TOPIC_SYS_DATA_SHARING_AGREEMENT_CREATED,
  TOPIC_SYS_DATA_SHARING_AGREEMENT_SUBMITTED,
  TOPIC_SYS_DATA_SHARING_AGREEMENT_ACCEPTED,
  TOPIC_SYS_DATA_SHARING_AGREEMENT_REJECTED,
  TOPIC_SYS_DATA_SHARING_AGREEMENT_REVOKED,
  TOPIC_SYS_DATA_SHARING_AGREEMENT_EXPIRED,
} from '@aris/shared-types';
import type {
  KafkaHeaders,
  PaginationQuery,
  PaginatedResponse,
  ApiResponse,
  CreateDataShareAgreementDto,
  UpdateDataShareAgreementDto,
  RejectAgreementDto,
  RevokeAgreementDto,
  DataShareAgreementDto,
  DataShareScope,
  ShareStatus,
} from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import type { AccessLogService } from './access-log.service';

const SERVICE_NAME = 'data-sharing-service';

export class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export interface AgreementListQuery extends PaginationQuery {
  status?: ShareStatus;
  dataDomain?: string;
  role?: 'sent' | 'received' | 'all';
}

export class AgreementService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafkaProducer: StandaloneKafkaProducer,
    private readonly accessLogService: AccessLogService,
  ) {}

  // ---------- CREATE ----------

  async create(
    dto: CreateDataShareAgreementDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<DataShareAgreementDto>> {
    if (!dto.recipientTenantId) {
      throw new HttpError(400, 'recipientTenantId is required');
    }

    // Resolve the owner (source) tenant.
    // - Continental users (CONTINENTAL_ADMIN/SUPER_ADMIN) may specify any
    //   ownerTenantId; default to their own when omitted.
    // - All other users always create on behalf of their own tenant — any
    //   ownerTenantId in the body must match user.tenantId.
    const isContinental = user.tenantLevel === TenantLevel.CONTINENTAL;
    let ownerTenantId = user.tenantId;
    const requestedOwner = (dto as any).ownerTenantId as string | undefined;
    if (requestedOwner) {
      if (isContinental) {
        ownerTenantId = requestedOwner;
      } else if (requestedOwner !== user.tenantId) {
        throw new HttpError(
          403,
          'Only continental users can set a different source tenant',
        );
      }
    }

    if (dto.recipientTenantId === ownerTenantId) {
      throw new HttpError(400, 'Recipient tenant must differ from source tenant');
    }

    const reference = await this.generateReference();

    const row = await (this.prisma as any).dataShareAgreement.create({
      data: {
        title: dto.title,
        description: dto.description ?? null,
        reference,
        owner_tenant_id: ownerTenantId,
        owner_user_id: user.userId,
        recipient_tenant_id: dto.recipientTenantId,
        data_domain: dto.dataDomain,
        data_scope: dto.dataScope as any,
        data_classification: dto.dataClassification ?? 'RESTRICTED',
        purpose: dto.purpose,
        legal_basis: dto.legalBasis ?? null,
        valid_from: new Date(dto.validFrom),
        valid_until: dto.validUntil ? new Date(dto.validUntil) : null,
        can_consult: dto.canConsult ?? true,
        can_export: dto.canExport ?? false,
        can_modify: dto.canModify ?? false,
        can_redistribute: dto.canRedistribute ?? false,
        max_records_per_query: dto.maxRecordsPerQuery ?? null,
        max_exports_per_month: dto.maxExportsPerMonth ?? null,
        require_mfa: dto.requireMfa ?? false,
        allowed_ip_ranges: dto.allowedIpRanges ?? [],
        status: 'DRAFT',
      },
    });

    await this.publishEvent(TOPIC_SYS_DATA_SHARING_AGREEMENT_CREATED, row, user);

    return { data: this.toEntity(row) };
  }

  // ---------- READ ----------

  async findAll(
    user: AuthenticatedUser,
    query: AgreementListQuery,
  ): Promise<PaginatedResponse<DataShareAgreementDto>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'desc' }
      : { created_at: 'desc' as const };

    const where: Record<string, unknown> = {
      ...this.buildTenantFilter(user, query.role),
      ...(query.status && { status: query.status }),
      ...(query.dataDomain && { data_domain: query.dataDomain }),
    };

    const [data, total] = await Promise.all([
      (this.prisma as any).dataShareAgreement.findMany({
        where,
        skip,
        take: limit,
        orderBy,
      }),
      (this.prisma as any).dataShareAgreement.count({ where }),
    ]);

    return {
      data: data.map((r: any) => this.toEntity(r)),
      meta: { total, page, limit },
    };
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<DataShareAgreementDto>> {
    const row = await this.getOrFail(id, user);
    return { data: this.toEntity(row) };
  }

  // ---------- UPDATE ----------

  async update(
    id: string,
    dto: UpdateDataShareAgreementDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<DataShareAgreementDto>> {
    const existing = await this.getOrFail(id, user);

    if (existing.owner_tenant_id !== user.tenantId) {
      throw new HttpError(403, 'Only the owner tenant can update this agreement');
    }
    if (existing.status !== 'DRAFT') {
      throw new HttpError(400, 'Only DRAFT agreements can be updated');
    }

    const data: Record<string, unknown> = {};
    if (dto.title !== undefined) data['title'] = dto.title;
    if (dto.description !== undefined) data['description'] = dto.description;
    if (dto.dataScope !== undefined) data['data_scope'] = dto.dataScope as any;
    if (dto.dataClassification !== undefined) data['data_classification'] = dto.dataClassification;
    if (dto.purpose !== undefined) data['purpose'] = dto.purpose;
    if (dto.legalBasis !== undefined) data['legal_basis'] = dto.legalBasis;
    if (dto.validFrom !== undefined) data['valid_from'] = new Date(dto.validFrom);
    if (dto.validUntil !== undefined) data['valid_until'] = dto.validUntil ? new Date(dto.validUntil) : null;
    if (dto.canConsult !== undefined) data['can_consult'] = dto.canConsult;
    if (dto.canExport !== undefined) data['can_export'] = dto.canExport;
    if (dto.canModify !== undefined) data['can_modify'] = dto.canModify;
    if (dto.canRedistribute !== undefined) data['can_redistribute'] = dto.canRedistribute;
    if (dto.maxRecordsPerQuery !== undefined) data['max_records_per_query'] = dto.maxRecordsPerQuery;
    if (dto.maxExportsPerMonth !== undefined) data['max_exports_per_month'] = dto.maxExportsPerMonth;
    if (dto.requireMfa !== undefined) data['require_mfa'] = dto.requireMfa;
    if (dto.allowedIpRanges !== undefined) data['allowed_ip_ranges'] = dto.allowedIpRanges;

    const updated = await (this.prisma as any).dataShareAgreement.update({
      where: { id },
      data,
    });

    return { data: this.toEntity(updated) };
  }

  // ---------- WORKFLOW TRANSITIONS ----------

  async submit(id: string, user: AuthenticatedUser): Promise<ApiResponse<DataShareAgreementDto>> {
    const existing = await this.getOrFail(id, user);

    if (existing.owner_tenant_id !== user.tenantId) {
      throw new HttpError(403, 'Only the owner tenant can submit this agreement');
    }
    if (existing.status !== 'DRAFT') {
      throw new HttpError(400, 'Only DRAFT agreements can be submitted');
    }

    const updated = await (this.prisma as any).dataShareAgreement.update({
      where: { id },
      data: { status: 'SUBMITTED', submitted_at: new Date() },
    });

    await this.publishEvent(TOPIC_SYS_DATA_SHARING_AGREEMENT_SUBMITTED, updated, user);
    return { data: this.toEntity(updated) };
  }

  async accept(id: string, user: AuthenticatedUser): Promise<ApiResponse<DataShareAgreementDto>> {
    const existing = await this.getOrFail(id, user);

    if (existing.recipient_tenant_id !== user.tenantId) {
      throw new HttpError(403, 'Only the recipient tenant can accept this agreement');
    }
    if (existing.status !== 'SUBMITTED') {
      throw new HttpError(400, 'Only SUBMITTED agreements can be accepted');
    }

    const now = new Date();
    const isActiveNow = new Date(existing.valid_from).getTime() <= now.getTime();

    const updated = await (this.prisma as any).dataShareAgreement.update({
      where: { id },
      data: {
        status: isActiveNow ? 'ACTIVE' : 'ACCEPTED',
        reviewed_at: now,
        reviewed_by: user.userId,
        recipient_user_id: user.userId,
      },
    });

    await this.publishEvent(TOPIC_SYS_DATA_SHARING_AGREEMENT_ACCEPTED, updated, user);
    return { data: this.toEntity(updated) };
  }

  async reject(
    id: string,
    dto: RejectAgreementDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<DataShareAgreementDto>> {
    if (!dto.rejectionReason || !dto.rejectionReason.trim()) {
      throw new HttpError(400, 'rejectionReason is required');
    }
    const existing = await this.getOrFail(id, user);

    if (existing.recipient_tenant_id !== user.tenantId) {
      throw new HttpError(403, 'Only the recipient tenant can reject this agreement');
    }
    if (existing.status !== 'SUBMITTED') {
      throw new HttpError(400, 'Only SUBMITTED agreements can be rejected');
    }

    const updated = await (this.prisma as any).dataShareAgreement.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewed_at: new Date(),
        reviewed_by: user.userId,
        rejection_reason: dto.rejectionReason,
      },
    });

    await this.publishEvent(TOPIC_SYS_DATA_SHARING_AGREEMENT_REJECTED, updated, user);
    return { data: this.toEntity(updated) };
  }

  async revoke(
    id: string,
    dto: RevokeAgreementDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<DataShareAgreementDto>> {
    if (!dto.revocationReason || !dto.revocationReason.trim()) {
      throw new HttpError(400, 'revocationReason is required');
    }
    const existing = await this.getOrFail(id, user);

    if (existing.owner_tenant_id !== user.tenantId) {
      throw new HttpError(403, 'Only the owner tenant can revoke this agreement');
    }
    if (!['SUBMITTED', 'ACCEPTED', 'ACTIVE'].includes(existing.status)) {
      throw new HttpError(400, 'Only SUBMITTED, ACCEPTED or ACTIVE agreements can be revoked');
    }

    const updated = await (this.prisma as any).dataShareAgreement.update({
      where: { id },
      data: {
        status: 'REVOKED',
        revoked_at: new Date(),
        revoked_by: user.userId,
        revocation_reason: dto.revocationReason,
      },
    });

    await this.publishEvent(TOPIC_SYS_DATA_SHARING_AGREEMENT_REVOKED, updated, user);
    return { data: this.toEntity(updated) };
  }

  // ---------- EXPIRY CRON ----------

  async expireDueAgreements(): Promise<{ count: number }> {
    const now = new Date();
    const due = await (this.prisma as any).dataShareAgreement.findMany({
      where: {
        status: 'ACTIVE',
        valid_until: { not: null, lt: now },
      },
    });

    let count = 0;
    for (const row of due) {
      const updated = await (this.prisma as any).dataShareAgreement.update({
        where: { id: row.id },
        data: { status: 'EXPIRED', expired_at: now },
      });
      try {
        const headers: KafkaHeaders = {
          correlationId: randomUUID(),
          sourceService: SERVICE_NAME,
          tenantId: updated.owner_tenant_id,
          userId: 'system',
          schemaVersion: '1',
          timestamp: new Date().toISOString(),
        };
        await this.kafkaProducer.send(
          TOPIC_SYS_DATA_SHARING_AGREEMENT_EXPIRED,
          updated.id,
          updated,
          headers,
        );
      } catch (err) {
        console.error(`[AgreementService] Failed to publish EXPIRED event for ${updated.id}`, err);
      }
      count += 1;
    }

    return { count };
  }

  // ---------- DATA ACCESS (stubs) ----------

  async previewData(
    id: string,
    user: AuthenticatedUser,
    queryFilters: Record<string, unknown>,
  ): Promise<{ data: unknown[]; meta: Record<string, unknown> }> {
    const agreement = await this.getOrFail(id, user);

    if (agreement.recipient_tenant_id !== user.tenantId) {
      throw new HttpError(403, 'Only the recipient tenant can query agreement data');
    }
    if (agreement.status !== 'ACTIVE') {
      throw new HttpError(400, 'Agreement is not active');
    }
    if (!agreement.can_consult) {
      throw new HttpError(403, 'Agreement does not allow consultation');
    }

    const maxRecords = agreement.max_records_per_query ?? null;

    // Phase 2 will proxy to source domain service. For now, return an empty placeholder.
    await this.accessLogService.log({
      agreementId: agreement.id,
      userId: user.userId,
      tenantId: user.tenantId,
      action: 'CONSULT',
      recordCount: 0,
      queryFilters,
      success: true,
    });

    return {
      data: [],
      meta: {
        recordCount: 0,
        maxRecordsPerQuery: maxRecords,
        agreement: {
          id: agreement.id,
          dataDomain: agreement.data_domain,
          dataScope: agreement.data_scope,
        },
      },
    };
  }

  async exportData(
    id: string,
    user: AuthenticatedUser,
    format: 'json' | 'csv',
  ): Promise<{ data: unknown[]; meta: Record<string, unknown> }> {
    const agreement = await this.getOrFail(id, user);

    if (agreement.recipient_tenant_id !== user.tenantId) {
      throw new HttpError(403, 'Only the recipient tenant can export agreement data');
    }
    if (agreement.status !== 'ACTIVE') {
      throw new HttpError(400, 'Agreement is not active');
    }
    if (!agreement.can_export) {
      throw new HttpError(403, 'Agreement does not allow export');
    }

    // Phase 2 will proxy to source domain service. For now, return an empty placeholder.
    await this.accessLogService.log({
      agreementId: agreement.id,
      userId: user.userId,
      tenantId: user.tenantId,
      action: 'EXPORT',
      recordCount: 0,
      queryFilters: { format },
      success: true,
    });

    return {
      data: [],
      meta: {
        recordCount: 0,
        format,
        agreement: {
          id: agreement.id,
          dataDomain: agreement.data_domain,
          dataScope: agreement.data_scope,
        },
      },
    };
  }

  // ---------- HELPERS ----------

  private async getOrFail(id: string, user: AuthenticatedUser): Promise<any> {
    const row = await (this.prisma as any).dataShareAgreement.findUnique({ where: { id } });
    if (!row) {
      throw new HttpError(404, `Agreement ${id} not found`);
    }
    this.verifyAccess(user, row);
    return row;
  }

  private verifyAccess(user: AuthenticatedUser, agreement: any): void {
    if (user.tenantLevel === TenantLevel.CONTINENTAL) return;
    if (agreement.owner_tenant_id === user.tenantId) return;
    if (agreement.recipient_tenant_id === user.tenantId) return;
    // Avoid leaking existence: 404 instead of 403
    throw new HttpError(404, 'Agreement not found');
  }

  private buildTenantFilter(
    user: AuthenticatedUser,
    role?: 'sent' | 'received' | 'all',
  ): Record<string, unknown> {
    if (user.tenantLevel === TenantLevel.CONTINENTAL) {
      if (role === 'sent') return { owner_tenant_id: user.tenantId };
      if (role === 'received') return { recipient_tenant_id: user.tenantId };
      return {};
    }

    if (role === 'sent') {
      return { owner_tenant_id: user.tenantId };
    }
    if (role === 'received') {
      return { recipient_tenant_id: user.tenantId };
    }
    return {
      OR: [
        { owner_tenant_id: user.tenantId },
        { recipient_tenant_id: user.tenantId },
      ],
    };
  }

  private async generateReference(): Promise<string> {
    const year = new Date().getFullYear();
    const start = new Date(year, 0, 1);
    const end = new Date(year + 1, 0, 1);
    const count = await (this.prisma as any).dataShareAgreement.count({
      where: { created_at: { gte: start, lt: end } },
    });
    const seq = String(count + 1).padStart(6, '0');
    return `DSA-${year}-${seq}`;
  }

  private async publishEvent(
    topic: string,
    agreement: { id: string; [key: string]: unknown },
    user: AuthenticatedUser,
  ): Promise<void> {
    const headers: KafkaHeaders = {
      correlationId: randomUUID(),
      sourceService: SERVICE_NAME,
      tenantId: user.tenantId,
      userId: user.userId,
      schemaVersion: '1',
      timestamp: new Date().toISOString(),
    };

    try {
      await this.kafkaProducer.send(topic, agreement.id, agreement, headers);
    } catch (error) {
      console.error(
        `[AgreementService] Failed to publish ${topic} for agreement ${agreement.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  toEntity(row: any): DataShareAgreementDto {
    return {
      id: row.id,
      reference: row.reference,
      title: row.title,
      description: row.description ?? null,
      ownerTenantId: row.owner_tenant_id,
      ownerUserId: row.owner_user_id,
      recipientTenantId: row.recipient_tenant_id,
      recipientUserId: row.recipient_user_id ?? null,
      dataDomain: row.data_domain,
      dataScope: row.data_scope as DataShareScope,
      dataClassification: row.data_classification,
      purpose: row.purpose,
      legalBasis: row.legal_basis ?? null,
      validFrom: row.valid_from instanceof Date ? row.valid_from.toISOString() : row.valid_from,
      validUntil: row.valid_until
        ? row.valid_until instanceof Date
          ? row.valid_until.toISOString()
          : row.valid_until
        : null,
      canConsult: row.can_consult,
      canExport: row.can_export,
      canModify: row.can_modify,
      canRedistribute: row.can_redistribute,
      maxRecordsPerQuery: row.max_records_per_query ?? null,
      maxExportsPerMonth: row.max_exports_per_month ?? null,
      requireMfa: row.require_mfa,
      allowedIpRanges: row.allowed_ip_ranges ?? [],
      status: row.status as ShareStatus,
      submittedAt: row.submitted_at ? (row.submitted_at instanceof Date ? row.submitted_at.toISOString() : row.submitted_at) : null,
      reviewedAt: row.reviewed_at ? (row.reviewed_at instanceof Date ? row.reviewed_at.toISOString() : row.reviewed_at) : null,
      reviewedBy: row.reviewed_by ?? null,
      rejectionReason: row.rejection_reason ?? null,
      revokedAt: row.revoked_at ? (row.revoked_at instanceof Date ? row.revoked_at.toISOString() : row.revoked_at) : null,
      revokedBy: row.revoked_by ?? null,
      revocationReason: row.revocation_reason ?? null,
      expiredAt: row.expired_at ? (row.expired_at instanceof Date ? row.expired_at.toISOString() : row.expired_at) : null,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
    };
  }
}

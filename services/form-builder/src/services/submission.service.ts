import { v4 as uuidv4 } from 'uuid';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import {
  TenantLevel,
  DataClassification,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from '@aris/shared-types';
import type {
  KafkaHeaders,
  PaginationQuery,
  PaginatedResponse,
  ApiResponse,
} from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { HttpError } from './template.service';

const SERVICE_NAME = 'form-builder-service';

export interface FormSubmissionEntity {
  id: string;
  tenantId: string;
  templateId: string;
  data: unknown;
  status: 'DRAFT' | 'SUBMITTED' | 'VALIDATED' | 'REJECTED';
  submittedBy: string;
  submittedAt: string | null;
  validatedBy: string | null;
  validatedAt: string | null;
  rejectionReason: string | null;
  geoLocation: unknown;
  deviceInfo: unknown;
  dataClassification: string;
  createdAt: Date;
  updatedAt: Date;
}

export class SubmissionService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafkaProducer: StandaloneKafkaProducer,
  ) {}

  async create(
    templateId: string,
    dto: {
      data: Record<string, unknown>;
      status?: string;
      geoLocation?: Record<string, unknown>;
      deviceInfo?: Record<string, unknown>;
    },
    user: AuthenticatedUser,
  ): Promise<ApiResponse<FormSubmissionEntity>> {
    // Verify template exists and is published
    const template = await (this.prisma as any).formTemplate.findUnique({
      where: { id: templateId },
    });
    if (!template) {
      throw new HttpError(404, `Template ${templateId} not found`);
    }
    this.verifyTenantAccess(user, template.tenant_id);

    if (template.status !== 'PUBLISHED') {
      throw new HttpError(400, 'Submissions are only accepted for published templates');
    }

    const submission = await (this.prisma as any).formSubmission.create({
      data: {
        tenant_id: user.tenantId,
        template_id: templateId,
        data: dto.data as Prisma.InputJsonValue,
        status: dto.status === 'SUBMITTED' ? 'SUBMITTED' : 'DRAFT',
        submitted_by: user.userId,
        submitted_at: dto.status === 'SUBMITTED' ? new Date() : null,
        geo_location: dto.geoLocation ? (dto.geoLocation as Prisma.InputJsonValue) : null,
        device_info: dto.deviceInfo ? (dto.deviceInfo as Prisma.InputJsonValue) : null,
        data_classification: template.data_classification,
      },
    });

    if (dto.status === 'SUBMITTED') {
      await this.publishEvent('ms.collecte.form.submitted.v1', submission, user);
    }

    console.log(`[SubmissionService] Submission created: ${submission.id} for template ${templateId}`);
    return { data: this.toEntity(submission) };
  }

  async findAll(
    templateId: string,
    user: AuthenticatedUser,
    query: PaginationQuery & { status?: string },
  ): Promise<PaginatedResponse<FormSubmissionEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      template_id: templateId,
      ...this.buildTenantFilter(user),
      ...(query.status && { status: query.status as string }),
    };

    const [data, total] = await Promise.all([
      (this.prisma as any).formSubmission.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      (this.prisma as any).formSubmission.count({ where }),
    ]);

    return {
      data: data.map((s: any) => this.toEntity(s)),
      meta: { total, page, limit },
    };
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<FormSubmissionEntity>> {
    const submission = await (this.prisma as any).formSubmission.findUnique({
      where: { id },
    });
    if (!submission) {
      throw new HttpError(404, `Submission ${id} not found`);
    }
    this.verifyTenantAccess(user, submission.tenant_id);
    return { data: this.toEntity(submission) };
  }

  async update(
    id: string,
    dto: { data?: Record<string, unknown>; status?: string },
    user: AuthenticatedUser,
  ): Promise<ApiResponse<FormSubmissionEntity>> {
    const existing = await (this.prisma as any).formSubmission.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new HttpError(404, `Submission ${id} not found`);
    }
    this.verifyTenantAccess(user, existing.tenant_id);

    if (existing.status === 'VALIDATED') {
      throw new HttpError(400, 'Cannot update a validated submission');
    }

    const submission = await (this.prisma as any).formSubmission.update({
      where: { id },
      data: {
        ...(dto.data !== undefined && { data: dto.data as Prisma.InputJsonValue }),
        ...(dto.status === 'SUBMITTED' && {
          status: 'SUBMITTED',
          submitted_at: new Date(),
        }),
      },
    });

    if (dto.status === 'SUBMITTED' && existing.status !== 'SUBMITTED') {
      await this.publishEvent('ms.collecte.form.submitted.v1', submission, user);
    }

    return { data: this.toEntity(submission) };
  }

  // ── Field data query for form-data-select ──

  async queryFieldValues(
    templateId: string,
    fieldCode: string,
    user: AuthenticatedUser,
    query: { search?: string; limit?: number },
  ): Promise<{ data: Array<{ value: unknown; label: string }> }> {
    const limit = Math.min(query.limit ?? 50, 200);

    const submissions = await (this.prisma as any).formSubmission.findMany({
      where: {
        template_id: templateId,
        status: { in: ['SUBMITTED', 'VALIDATED'] },
        ...this.buildTenantFilter(user),
      },
      select: { data: true },
      take: 1000, // scan up to 1000 submissions for unique values
    });

    const uniqueValues = new Map<string, unknown>();
    for (const sub of submissions) {
      const val = (sub.data as Record<string, unknown>)?.[fieldCode];
      if (val !== undefined && val !== null && val !== '') {
        uniqueValues.set(String(val), val);
      }
    }

    let results = Array.from(uniqueValues.entries()).map(([key, val]) => ({
      value: val,
      label: key,
    }));

    if (query.search) {
      const search = query.search.toLowerCase();
      results = results.filter((r) => r.label.toLowerCase().includes(search));
    }

    return { data: results.slice(0, limit) };
  }

  // ── Helpers ──

  private buildTenantFilter(user: AuthenticatedUser): Record<string, unknown> {
    if (user.tenantLevel === TenantLevel.CONTINENTAL) return {};
    return { tenant_id: user.tenantId };
  }

  private verifyTenantAccess(user: AuthenticatedUser, submissionTenantId: string): void {
    if (user.tenantLevel === TenantLevel.CONTINENTAL) return;
    if (submissionTenantId === user.tenantId) return;
    throw new HttpError(404, 'Submission not found');
  }

  private async publishEvent(
    topic: string,
    submission: { id: string; [key: string]: unknown },
    user: AuthenticatedUser,
  ): Promise<void> {
    const headers: KafkaHeaders = {
      correlationId: uuidv4(),
      sourceService: SERVICE_NAME,
      tenantId: user.tenantId,
      userId: user.userId,
      schemaVersion: '1',
      timestamp: new Date().toISOString(),
    };

    try {
      await this.kafkaProducer.send(topic, submission.id as string, submission, headers);
    } catch (error) {
      console.error(
        `[SubmissionService] Failed to publish ${topic} for submission ${submission.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private toEntity(row: {
    id: string;
    tenant_id: string;
    template_id: string;
    data: unknown;
    status: string;
    submitted_by: string;
    submitted_at: Date | null;
    validated_by: string | null;
    validated_at: Date | null;
    rejection_reason: string | null;
    geo_location: unknown;
    device_info: unknown;
    data_classification: string;
    created_at: Date;
    updated_at: Date;
  }): FormSubmissionEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      templateId: row.template_id,
      data: row.data,
      status: row.status as FormSubmissionEntity['status'],
      submittedBy: row.submitted_by,
      submittedAt: row.submitted_at?.toISOString() ?? null,
      validatedBy: row.validated_by,
      validatedAt: row.validated_at?.toISOString() ?? null,
      rejectionReason: row.rejection_reason,
      geoLocation: row.geo_location,
      deviceInfo: row.device_info,
      dataClassification: row.data_classification,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

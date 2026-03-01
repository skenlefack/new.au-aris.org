import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import {
  TenantLevel,
  DataClassification,
  TOPIC_MS_FORMBUILDER_TEMPLATE_CREATED,
  TOPIC_MS_FORMBUILDER_TEMPLATE_PUBLISHED,
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
import type { FormTemplateEntity } from '../template/entities/template.entity';

const SERVICE_NAME = 'form-builder-service';

/** Lightweight HTTP error for Fastify error handler */
export class HttpError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

export class TemplateService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafkaProducer: StandaloneKafkaProducer,
  ) {}

  async create(
    dto: {
      name: string;
      domain: string;
      parentTemplateId?: string;
      schema: Record<string, unknown>;
      uiSchema?: Record<string, unknown>;
      dataContractId?: string;
      dataClassification?: string;
    },
    user: AuthenticatedUser,
  ): Promise<ApiResponse<FormTemplateEntity>> {
    if (dto.parentTemplateId) {
      const parent = await (this.prisma as any).formTemplate.findUnique({
        where: { id: dto.parentTemplateId },
      });
      if (!parent) {
        throw new HttpError(404, `Parent template ${dto.parentTemplateId} not found`);
      }
    }

    const existing = await (this.prisma as any).formTemplate.findFirst({
      where: {
        tenant_id: user.tenantId,
        name: dto.name,
        version: 1,
      },
    });
    if (existing) {
      throw new HttpError(409, `Template "${dto.name}" version 1 already exists for this tenant`);
    }

    const template = await (this.prisma as any).formTemplate.create({
      data: {
        tenant_id: user.tenantId,
        name: dto.name,
        domain: dto.domain,
        version: 1,
        parent_template_id: dto.parentTemplateId ?? null,
        schema: dto.schema as Prisma.InputJsonValue,
        ui_schema: (dto.uiSchema ?? {}) as Prisma.InputJsonValue,
        data_contract_id: dto.dataContractId ?? null,
        status: 'DRAFT',
        data_classification:
          dto.dataClassification ?? DataClassification.RESTRICTED,
        created_by: user.userId,
      },
    });

    await this.publishEvent(
      TOPIC_MS_FORMBUILDER_TEMPLATE_CREATED,
      template,
      user,
    );

    console.log(`[TemplateService] Template created: ${template.name} v${template.version} (${template.id})`);
    return { data: this.toEntity(template) };
  }

  async findAll(
    user: AuthenticatedUser,
    query: PaginationQuery & { domain?: string; status?: string },
  ): Promise<PaginatedResponse<FormTemplateEntity & { overlayCount?: number; hasOverlay?: boolean }>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'asc' }
      : { created_at: 'asc' as const };

    const where: Prisma.FormTemplateWhereInput = {
      ...this.buildTenantFilter(user),
      ...(query.domain && { domain: query.domain }),
      ...(query.status && { status: query.status as Prisma.EnumFormTemplateStatusFilter }),
    };

    const [data, total] = await Promise.all([
      (this.prisma as any).formTemplate.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: { _count: { select: { overlays: true } } },
      }),
      (this.prisma as any).formTemplate.count({ where }),
    ]);

    return {
      data: data.map((t: any) => ({
        ...this.toEntity(t),
        overlayCount: t._count?.overlays ?? 0,
        hasOverlay: (t._count?.overlays ?? 0) > 0,
      })),
      meta: { total, page, limit },
    };
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
    resolveTenantId?: string,
  ): Promise<ApiResponse<FormTemplateEntity>> {
    const template = await (this.prisma as any).formTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      throw new HttpError(404, `Template ${id} not found`);
    }

    this.verifyTenantAccess(user, template.tenant_id);

    const resolved = await this.resolveInheritance(template);

    // If a tenantId is provided, also resolve overlays
    if (resolveTenantId) {
      const { FormResolverService } = await import('./form-resolver.service');
      const resolver = new FormResolverService(this.prisma);
      const resolvedForm = await resolver.resolveForm(id, resolveTenantId);
      return {
        data: {
          ...resolved,
          schema: {
            ...(resolved.schema as Record<string, unknown>),
            _resolved: true,
            _resolvedFields: resolvedForm.resolvedFields,
            _resolvedSections: resolvedForm.resolvedSections,
            _inheritance: resolvedForm.inheritance,
            _appliedOverlays: resolvedForm.appliedOverlays.map(o => ({
              id: o.id,
              tenantId: o.tenantId,
              tenantLevel: o.tenantLevel,
            })),
          },
        },
      };
    }

    return { data: resolved };
  }

  async update(
    id: string,
    dto: {
      name?: string;
      domain?: string;
      schema?: Record<string, unknown>;
      uiSchema?: Record<string, unknown>;
      dataContractId?: string;
      dataClassification?: string;
    },
    user: AuthenticatedUser,
  ): Promise<ApiResponse<FormTemplateEntity>> {
    const existing = await (this.prisma as any).formTemplate.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new HttpError(404, `Template ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenant_id);

    if (existing.status === 'ARCHIVED') {
      throw new HttpError(400, 'Cannot update an archived template');
    }

    if (existing.status === 'PUBLISHED') {
      return this.createNewVersion(existing, dto, user);
    }

    const template = await (this.prisma as any).formTemplate.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.domain !== undefined && { domain: dto.domain }),
        ...(dto.schema !== undefined && {
          schema: dto.schema as Prisma.InputJsonValue,
        }),
        ...(dto.uiSchema !== undefined && {
          ui_schema: dto.uiSchema as Prisma.InputJsonValue,
        }),
        ...(dto.dataContractId !== undefined && {
          data_contract_id: dto.dataContractId,
        }),
        ...(dto.dataClassification !== undefined && {
          data_classification: dto.dataClassification,
        }),
        updated_by: user.userId,
      },
    });

    console.log(`[TemplateService] Template updated: ${template.name} v${template.version} (${template.id})`);
    return { data: this.toEntity(template) };
  }

  async publish(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<FormTemplateEntity>> {
    const existing = await (this.prisma as any).formTemplate.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new HttpError(404, `Template ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenant_id);

    if (existing.status !== 'DRAFT') {
      throw new HttpError(400, `Only DRAFT templates can be published (current: ${existing.status})`);
    }

    const template = await (this.prisma as any).formTemplate.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        published_at: new Date(),
        updated_by: user.userId,
      },
    });

    await this.publishEvent(
      TOPIC_MS_FORMBUILDER_TEMPLATE_PUBLISHED,
      template,
      user,
    );

    console.log(`[TemplateService] Template published: ${template.name} v${template.version} (${template.id})`);
    return { data: this.toEntity(template) };
  }

  async archive(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<FormTemplateEntity>> {
    const existing = await (this.prisma as any).formTemplate.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new HttpError(404, `Template ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenant_id);

    if (existing.status === 'ARCHIVED') {
      throw new HttpError(400, 'Template is already archived');
    }

    const template = await (this.prisma as any).formTemplate.update({
      where: { id },
      data: {
        status: 'ARCHIVED',
        archived_at: new Date(),
        updated_by: user.userId,
      },
    });

    console.log(`[TemplateService] Template archived: ${template.name} v${template.version} (${template.id})`);
    return { data: this.toEntity(template) };
  }

  async preview(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<FormTemplateEntity>> {
    return this.findOne(id, user);
  }

  async duplicate(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<FormTemplateEntity>> {
    const existing = await (this.prisma as any).formTemplate.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new HttpError(404, `Template ${id} not found`);
    }
    this.verifyTenantAccess(user, existing.tenant_id);

    const copyName = `${existing.name} (Copy)`;
    const template = await (this.prisma as any).formTemplate.create({
      data: {
        tenant_id: user.tenantId,
        name: copyName,
        domain: existing.domain,
        version: 1,
        parent_template_id: null,
        schema: existing.schema as Prisma.InputJsonValue,
        ui_schema: existing.ui_schema as Prisma.InputJsonValue,
        data_contract_id: existing.data_contract_id,
        status: 'DRAFT',
        data_classification: existing.data_classification,
        created_by: user.userId,
      },
    });

    console.log(`[TemplateService] Template duplicated: ${template.name} v${template.version} (${template.id})`);
    return { data: this.toEntity(template) };
  }

  async remove(
    id: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    const existing = await (this.prisma as any).formTemplate.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new HttpError(404, `Template ${id} not found`);
    }
    this.verifyTenantAccess(user, existing.tenant_id);

    if (existing.status !== 'DRAFT') {
      throw new HttpError(400, 'Only DRAFT templates can be deleted');
    }

    await (this.prisma as any).formTemplate.delete({ where: { id } });
    console.log(`[TemplateService] Template deleted: ${existing.name} v${existing.version} (${id})`);
  }

  async importFromExcel(
    fileBuffer: Buffer,
    dto: { name: string; domain: string },
    user: AuthenticatedUser,
  ): Promise<ApiResponse<FormTemplateEntity>> {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new HttpError(400, 'Excel file contains no sheets');
    }

    const sheet = workbook.Sheets[sheetName];
    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (rows.length < 1) {
      throw new HttpError(400, 'Excel sheet is empty');
    }

    const headers = (rows[0] as string[]).filter(Boolean);
    if (headers.length === 0) {
      throw new HttpError(400, 'No column headers found in Excel');
    }

    // Auto-detect field types from column headers and first data rows
    const fields = headers.map((header, index) => {
      const code = String(header)
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '_')
        .replace(/^_|_$/g, '')
        .substring(0, 50) || `field_${index + 1}`;

      const sampleValues: unknown[] = [];
      for (let r = 1; r < Math.min(rows.length, 20); r++) {
        const row = rows[r] as unknown[];
        if (row && row[index] !== undefined && row[index] !== null && row[index] !== '') {
          sampleValues.push(row[index]);
        }
      }

      const fieldType = this.inferFieldType(code, sampleValues);

      return {
        id: uuidv4(),
        type: fieldType,
        code,
        label: { en: String(header) },
        placeholder: { en: '' },
        helpText: { en: '' },
        column: 1,
        columnSpan: 1,
        order: index,
        required: false,
        readOnly: false,
        hidden: false,
        defaultValue: null,
        validation: {},
        conditions: [],
        properties: {},
      };
    });

    const schema = {
      sections: [{
        id: uuidv4(),
        name: { en: sheetName || 'Imported Data' },
        description: { en: `Imported from Excel (${headers.length} columns)` },
        columns: headers.length <= 4 ? 2 : 3,
        order: 0,
        isCollapsible: true,
        isCollapsed: false,
        isRepeatable: false,
        conditions: [],
        fields,
      }],
      settings: {
        allowDraft: true,
        allowAttachments: true,
        maxAttachments: 10,
        allowOffline: true,
        requireGeoLocation: false,
        autoSaveInterval: 30,
        submissionWorkflow: 'review_then_validate',
        notifyOnSubmit: [],
        duplicateDetection: { enabled: false, fields: [] },
      },
    };

    // If multiple sheets, add additional sections
    for (let si = 1; si < workbook.SheetNames.length; si++) {
      const extraSheet = workbook.Sheets[workbook.SheetNames[si]];
      const extraRows: unknown[][] = XLSX.utils.sheet_to_json(extraSheet, { header: 1 });
      if (extraRows.length < 1) continue;

      const extraHeaders = (extraRows[0] as string[]).filter(Boolean);
      if (extraHeaders.length === 0) continue;

      const extraFields = extraHeaders.map((header, idx) => {
        const code = String(header)
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .replace(/\s+/g, '_')
          .replace(/^_|_$/g, '')
          .substring(0, 50) || `field_${idx + 1}`;

        const sampleValues: unknown[] = [];
        for (let r = 1; r < Math.min(extraRows.length, 20); r++) {
          const row = extraRows[r] as unknown[];
          if (row && row[idx] !== undefined && row[idx] !== null && row[idx] !== '') {
            sampleValues.push(row[idx]);
          }
        }

        return {
          id: uuidv4(),
          type: this.inferFieldType(code, sampleValues),
          code: `${workbook.SheetNames[si].toLowerCase().replace(/\s+/g, '_')}_${code}`,
          label: { en: String(header) },
          placeholder: { en: '' },
          helpText: { en: '' },
          column: 1,
          columnSpan: 1,
          order: idx,
          required: false,
          readOnly: false,
          hidden: false,
          defaultValue: null,
          validation: {},
          conditions: [],
          properties: {},
        };
      });

      schema.sections.push({
        id: uuidv4(),
        name: { en: workbook.SheetNames[si] },
        description: { en: `Imported from sheet "${workbook.SheetNames[si]}"` },
        columns: 2,
        order: si,
        isCollapsible: true,
        isCollapsed: false,
        isRepeatable: false,
        conditions: [],
        fields: extraFields,
      });
    }

    return this.create({ name: dto.name, domain: dto.domain, schema: schema as Record<string, unknown> }, user);
  }

  private inferFieldType(code: string, samples: unknown[]): string {
    const lc = code.toLowerCase();
    // Name-based heuristics
    if (lc.includes('email') || lc.includes('courriel')) return 'email';
    if (lc.includes('phone') || lc.includes('tel') || lc.includes('mobile')) return 'phone';
    if (lc.includes('url') || lc.includes('website') || lc.includes('link')) return 'url';
    if (lc.includes('date') || lc.includes('dob') || lc.includes('birth')) return 'date';
    if (lc.includes('time') && !lc.includes('date')) return 'time';
    if (lc.includes('latitude') || lc.includes('longitude') || lc.includes('gps') || lc.includes('coord')) return 'geo-point';
    if (lc.includes('photo') || lc.includes('image') || lc.includes('picture')) return 'image';
    if (lc.includes('file') || lc.includes('attachment') || lc.includes('document')) return 'file-upload';
    if (lc.includes('comment') || lc.includes('description') || lc.includes('notes') || lc.includes('remark')) return 'textarea';

    // Value-based heuristics
    if (samples.length === 0) return 'text';

    const allNumbers = samples.every((v) => typeof v === 'number' || (typeof v === 'string' && !isNaN(Number(v)) && v.trim() !== ''));
    if (allNumbers) return 'number';

    const allDates = samples.every((v) => {
      if (v instanceof Date) return true;
      if (typeof v === 'number' && v > 30000 && v < 60000) return true; // Excel date serial
      if (typeof v === 'string') {
        const d = new Date(v);
        return !isNaN(d.getTime()) && v.length >= 8;
      }
      return false;
    });
    if (allDates) return 'date';

    const uniqueValues = new Set(samples.map(String));
    if (uniqueValues.size <= 10 && samples.length >= 3) return 'select';

    return 'text';
  }

  // ── Inheritance Resolution ──

  async resolveInheritance(
    template: {
      id: string;
      tenant_id: string;
      name: string;
      domain: string;
      version: number;
      parent_template_id: string | null;
      schema: unknown;
      ui_schema: unknown;
      data_contract_id: string | null;
      status: string;
      data_classification: string;
      created_by: string;
      updated_by: string | null;
      published_at: Date | null;
      archived_at: Date | null;
      created_at: Date;
      updated_at: Date;
    },
  ): Promise<FormTemplateEntity> {
    if (!template.parent_template_id) {
      return this.toEntity(template);
    }

    const chain = await this.getInheritanceChain(template.parent_template_id);

    let mergedSchema: Record<string, unknown> = {};
    let mergedUiSchema: Record<string, unknown> = {};

    for (const ancestor of chain.reverse()) {
      mergedSchema = this.deepMergeSchema(
        mergedSchema,
        ancestor.schema as Record<string, unknown>,
      );
      mergedUiSchema = this.deepMergeSchema(
        mergedUiSchema,
        ancestor.ui_schema as Record<string, unknown>,
      );
    }

    mergedSchema = this.deepMergeSchema(
      mergedSchema,
      template.schema as Record<string, unknown>,
    );
    mergedUiSchema = this.deepMergeSchema(
      mergedUiSchema,
      template.ui_schema as Record<string, unknown>,
    );

    const entity = this.toEntity(template);
    entity.schema = mergedSchema;
    entity.uiSchema = mergedUiSchema;
    return entity;
  }

  private async getInheritanceChain(
    parentId: string,
    visited: Set<string> = new Set(),
  ): Promise<Array<{ schema: unknown; ui_schema: unknown; parent_template_id: string | null; id: string }>> {
    if (visited.has(parentId)) {
      throw new HttpError(400, 'Circular inheritance detected');
    }
    visited.add(parentId);

    const parent = await (this.prisma as any).formTemplate.findUnique({
      where: { id: parentId },
    });

    if (!parent) {
      return [];
    }

    const ancestors = parent.parent_template_id
      ? await this.getInheritanceChain(parent.parent_template_id, visited)
      : [];

    return [...ancestors, parent];
  }

  deepMergeSchema(
    parent: Record<string, unknown>,
    child: Record<string, unknown>,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = { ...parent };

    for (const key of Object.keys(child)) {
      const parentVal = parent[key];
      const childVal = child[key];

      if (key === 'required' && Array.isArray(parentVal) && Array.isArray(childVal)) {
        result[key] = [...new Set([...parentVal, ...childVal])];
      } else if (key === 'properties' && isPlainObject(parentVal) && isPlainObject(childVal)) {
        result[key] = this.deepMergeSchema(
          parentVal as Record<string, unknown>,
          childVal as Record<string, unknown>,
        );
      } else {
        result[key] = childVal;
      }
    }

    return result;
  }

  // ── Version Management ──

  private async createNewVersion(
    existing: {
      id: string;
      tenant_id: string;
      name: string;
      domain: string;
      version: number;
      parent_template_id: string | null;
      schema: unknown;
      ui_schema: unknown;
      data_contract_id: string | null;
      data_classification: string;
      created_by: string;
    },
    dto: {
      name?: string;
      domain?: string;
      schema?: Record<string, unknown>;
      uiSchema?: Record<string, unknown>;
      dataContractId?: string;
      dataClassification?: string;
    },
    user: AuthenticatedUser,
  ): Promise<ApiResponse<FormTemplateEntity>> {
    const latest = await (this.prisma as any).formTemplate.findFirst({
      where: {
        tenant_id: existing.tenant_id,
        name: existing.name,
      },
      orderBy: { version: 'desc' },
    });

    const nextVersion = (latest?.version ?? existing.version) + 1;

    const template = await (this.prisma as any).formTemplate.create({
      data: {
        tenant_id: existing.tenant_id,
        name: dto.name ?? existing.name,
        domain: dto.domain ?? existing.domain,
        version: nextVersion,
        parent_template_id: existing.parent_template_id,
        schema: (dto.schema ?? existing.schema) as Prisma.InputJsonValue,
        ui_schema: (dto.uiSchema ?? existing.ui_schema) as Prisma.InputJsonValue,
        data_contract_id: dto.dataContractId ?? existing.data_contract_id,
        status: 'DRAFT',
        data_classification:
          dto.dataClassification ?? existing.data_classification,
        created_by: user.userId,
      },
    });

    console.log(
      `[TemplateService] New version: ${template.name} v${template.version} (${template.id}) from v${existing.version}`,
    );
    return { data: this.toEntity(template) };
  }

  // ── Tenant Filtering ──

  private buildTenantFilter(
    user: AuthenticatedUser,
  ): Prisma.FormTemplateWhereInput {
    switch (user.tenantLevel) {
      case TenantLevel.CONTINENTAL:
        return {};
      case TenantLevel.REC:
        return {
          OR: [
            { tenant_id: user.tenantId },
            { status: 'PUBLISHED' },
          ],
        };
      case TenantLevel.MEMBER_STATE:
        return {
          OR: [
            { tenant_id: user.tenantId },
            { status: 'PUBLISHED' },
          ],
        };
      default:
        return { tenant_id: user.tenantId };
    }
  }

  private verifyTenantAccess(
    user: AuthenticatedUser,
    templateTenantId: string,
  ): void {
    if (user.tenantLevel === TenantLevel.CONTINENTAL) {
      return;
    }
    if (templateTenantId === user.tenantId) {
      return;
    }
    throw new HttpError(404, 'Template not found');
  }

  // ── Kafka Events ──

  private async publishEvent(
    topic: string,
    template: { id: string; [key: string]: unknown },
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
      await this.kafkaProducer.send(topic, template.id as string, template, headers);
    } catch (error) {
      console.error(
        `[TemplateService] Failed to publish ${topic} for template ${template.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // ── Mapping ──

  private toEntity(row: {
    id: string;
    tenant_id: string;
    name: string;
    domain: string;
    version: number;
    parent_template_id: string | null;
    schema: unknown;
    ui_schema: unknown;
    data_contract_id: string | null;
    status: string;
    data_classification: string;
    created_by: string;
    updated_by: string | null;
    published_at: Date | null;
    archived_at: Date | null;
    created_at: Date;
    updated_at: Date;
  }): FormTemplateEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      domain: row.domain,
      version: row.version,
      parentTemplateId: row.parent_template_id,
      schema: row.schema,
      uiSchema: row.ui_schema,
      dataContractId: row.data_contract_id,
      status: row.status as FormTemplateEntity['status'],
      dataClassification: row.data_classification as DataClassification,
      createdBy: row.created_by,
      updatedBy: row.updated_by,
      publishedAt: row.published_at,
      archivedAt: row.archived_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

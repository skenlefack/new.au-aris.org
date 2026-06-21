import { v4 as uuidv4 } from 'uuid';
import type { PrismaClient, Prisma } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import { TenantLevel } from '@aris/shared-types';
import type { KafkaHeaders, ApiResponse, PaginatedResponse } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  TOPIC_MS_FORMBUILDER_EXTENSION_CREATED,
  TOPIC_MS_FORMBUILDER_EXTENSION_FIELD_ADDED,
  TOPIC_MS_FORMBUILDER_EXTENSION_SUBMITTED,
  TOPIC_MS_FORMBUILDER_EXTENSION_VALIDATED,
  TOPIC_MS_FORMBUILDER_EXTENSION_PUBLISHED,
} from '@aris/shared-types';
import { FormResolverService } from './form-resolver.service';

const SERVICE_NAME = 'form-builder-service';

// ── Error ──

class HttpError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

// ── Entities ──

export interface FormExtensionEntity {
  id: string;
  baseFormId: string;
  baseFormVersion: number;
  campaignId: string;
  level: string;
  tenantId: string;
  version: number;
  status: string;
  createdBy: string;
  validatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  fields: FormExtensionFieldEntity[];
}

export interface FormExtensionFieldEntity {
  id: string;
  extensionId: string;
  fieldKey: string;
  labelI18n: Record<string, string>;
  type: string;
  required: boolean;
  validationRules: unknown | null;
  referenceDataId: string | null;
  properties: unknown | null;
  order: number;
  createdAt: Date;
}

export interface EffectiveForm {
  template: {
    id: string;
    name: string;
    version: number;
    schema: unknown;
  };
  baseFields: EffectiveField[];
  extensionFields: EffectiveField[];
  allFields: EffectiveField[];
  extension: {
    id: string;
    level: string;
    tenantId: string;
    version: number;
  } | null;
}

export interface EffectiveField {
  id: string;
  fieldKey: string;
  label: unknown;
  type: string;
  required: boolean;
  order: number;
  origin: 'base' | 'extension';
  locked: boolean;
  section?: string;
  validation?: unknown;
  properties?: unknown;
  referenceDataId?: string | null;
  [key: string]: unknown;
}

// ── Service ──

export class ExtensionService {
  private readonly resolver: FormResolverService;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafkaProducer: StandaloneKafkaProducer,
  ) {
    this.resolver = new FormResolverService(prisma);
  }

  // ── Create Extension ──

  async createExtension(
    baseFormId: string,
    dto: { campaignId: string; level: string; tenantId: string },
    user: AuthenticatedUser,
  ): Promise<ApiResponse<FormExtensionEntity>> {
    // Validate base form exists
    const template = await (this.prisma as any).formTemplate.findUnique({
      where: { id: baseFormId },
    });
    if (!template) {
      throw new HttpError(404, `Base form ${baseFormId} not found`);
    }

    // Validate level
    if (dto.level !== 'REC' && dto.level !== 'COUNTRY') {
      throw new HttpError(400, 'Extension level must be REC or COUNTRY');
    }

    // Validate tenant permission
    this.verifyExtensionPermission(user, dto.tenantId, dto.level);

    // Check for existing DRAFT/PENDING extension for this scope
    const existing = await (this.prisma as any).formExtension.findFirst({
      where: {
        base_form_id: baseFormId,
        campaign_id: dto.campaignId,
        level: dto.level,
        tenant_id: dto.tenantId,
        status: { in: ['DRAFT', 'PENDING_VALIDATION'] },
      },
    });
    if (existing) {
      throw new HttpError(409, 'An active extension already exists for this scope. Edit the existing one or archive it first.');
    }

    // Determine next version
    const lastPublished = await (this.prisma as any).formExtension.findFirst({
      where: {
        base_form_id: baseFormId,
        campaign_id: dto.campaignId,
        level: dto.level,
        tenant_id: dto.tenantId,
        status: 'PUBLISHED',
      },
      orderBy: { version: 'desc' },
    });
    const nextVersion = lastPublished ? lastPublished.version + 1 : 1;

    const extension = await (this.prisma as any).formExtension.create({
      data: {
        base_form_id: baseFormId,
        base_form_version: template.version,
        campaign_id: dto.campaignId,
        level: dto.level,
        tenant_id: dto.tenantId,
        version: nextVersion,
        status: 'DRAFT',
        created_by: user.userId,
      },
      include: { fields: true },
    });

    await this.publishEvent(TOPIC_MS_FORMBUILDER_EXTENSION_CREATED, {
      extensionId: extension.id,
      baseFormId,
      baseFormVersion: template.version,
      campaignId: dto.campaignId,
      level: dto.level,
      tenantId: dto.tenantId,
      version: nextVersion,
    }, user);

    return { data: this.toEntity(extension) };
  }

  // ── List Extensions ──

  async listExtensions(
    baseFormId: string,
    query: { campaignId: string; tenantId?: string; page?: number; limit?: number },
    user: AuthenticatedUser,
  ): Promise<PaginatedResponse<FormExtensionEntity>> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: any = {
      base_form_id: baseFormId,
      campaign_id: query.campaignId,
    };

    // Filter by tenantId if provided, otherwise scope by user's access
    if (query.tenantId) {
      where.tenant_id = query.tenantId;
    } else if (user.tenantLevel !== TenantLevel.CONTINENTAL) {
      where.tenant_id = user.tenantId;
    }

    const [data, total] = await Promise.all([
      (this.prisma as any).formExtension.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: { fields: { orderBy: { order: 'asc' } } },
      }),
      (this.prisma as any).formExtension.count({ where }),
    ]);

    return {
      data: data.map((e: any) => this.toEntity(e)),
      meta: { total, page, limit },
    };
  }

  // ── Get Extension ──

  async getExtension(
    extensionId: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<FormExtensionEntity>> {
    const ext = await (this.prisma as any).formExtension.findUnique({
      where: { id: extensionId },
      include: { fields: { orderBy: { order: 'asc' } } },
    });
    if (!ext) {
      throw new HttpError(404, `Extension ${extensionId} not found`);
    }

    this.verifyReadAccess(user, ext.tenant_id);

    return { data: this.toEntity(ext) };
  }

  // ── Add Field ──

  async addField(
    extensionId: string,
    dto: {
      fieldKey: string;
      labelI18n: Record<string, string>;
      type: string;
      required?: boolean;
      validationRules?: unknown;
      referenceDataId?: string;
      properties?: unknown;
      order?: number;
    },
    user: AuthenticatedUser,
  ): Promise<ApiResponse<FormExtensionFieldEntity>> {
    const ext = await (this.prisma as any).formExtension.findUnique({
      where: { id: extensionId },
      include: { fields: true },
    });
    if (!ext) {
      throw new HttpError(404, `Extension ${extensionId} not found`);
    }

    // Only DRAFT extensions can be edited
    if (ext.status !== 'DRAFT') {
      throw new HttpError(400, `Cannot add fields to extension in status ${ext.status}. Only DRAFT extensions can be edited.`);
    }

    this.verifyExtensionPermission(user, ext.tenant_id, ext.level);

    // ── Conflict Detection ──
    await this.detectFieldKeyConflict(ext, dto.fieldKey);

    // Determine order
    const maxOrder = ext.fields.length > 0
      ? Math.max(...ext.fields.map((f: any) => f.order))
      : -1;
    const order = dto.order ?? maxOrder + 1;

    const field = await (this.prisma as any).formExtensionField.create({
      data: {
        extension_id: extensionId,
        field_key: dto.fieldKey,
        label_i18n: dto.labelI18n as Prisma.InputJsonValue,
        type: dto.type,
        required: dto.required ?? false,
        validation_rules: dto.validationRules ? (dto.validationRules as Prisma.InputJsonValue) : undefined,
        reference_data_id: dto.referenceDataId ?? undefined,
        properties: dto.properties ? (dto.properties as Prisma.InputJsonValue) : undefined,
        order,
      },
    });

    // Update extension timestamp
    await (this.prisma as any).formExtension.update({
      where: { id: extensionId },
      data: { updated_at: new Date() },
    });

    await this.publishEvent(TOPIC_MS_FORMBUILDER_EXTENSION_FIELD_ADDED, {
      extensionId,
      fieldId: field.id,
      fieldKey: dto.fieldKey,
      baseFormId: ext.base_form_id,
      campaignId: ext.campaign_id,
      level: ext.level,
      tenantId: ext.tenant_id,
    }, user);

    return { data: this.toFieldEntity(field) };
  }

  // ── Update Field ──

  async updateField(
    extensionId: string,
    fieldId: string,
    dto: {
      fieldKey?: string;
      labelI18n?: Record<string, string>;
      type?: string;
      required?: boolean;
      validationRules?: unknown | null;
      referenceDataId?: string | null;
      properties?: unknown | null;
      order?: number;
    },
    user: AuthenticatedUser,
  ): Promise<ApiResponse<FormExtensionFieldEntity>> {
    const ext = await (this.prisma as any).formExtension.findUnique({
      where: { id: extensionId },
    });
    if (!ext) {
      throw new HttpError(404, `Extension ${extensionId} not found`);
    }
    if (ext.status !== 'DRAFT') {
      throw new HttpError(400, `Cannot update fields on extension in status ${ext.status}`);
    }

    this.verifyExtensionPermission(user, ext.tenant_id, ext.level);

    const field = await (this.prisma as any).formExtensionField.findUnique({
      where: { id: fieldId },
    });
    if (!field || field.extension_id !== extensionId) {
      throw new HttpError(404, `Field ${fieldId} not found in extension ${extensionId}`);
    }

    // If fieldKey changed, run conflict detection
    if (dto.fieldKey && dto.fieldKey !== field.field_key) {
      await this.detectFieldKeyConflict(ext, dto.fieldKey);
    }

    const updated = await (this.prisma as any).formExtensionField.update({
      where: { id: fieldId },
      data: {
        ...(dto.fieldKey !== undefined && { field_key: dto.fieldKey }),
        ...(dto.labelI18n !== undefined && { label_i18n: dto.labelI18n as Prisma.InputJsonValue }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.required !== undefined && { required: dto.required }),
        ...(dto.validationRules !== undefined && {
          validation_rules: dto.validationRules === null ? null : (dto.validationRules as Prisma.InputJsonValue),
        }),
        ...(dto.referenceDataId !== undefined && { reference_data_id: dto.referenceDataId }),
        ...(dto.properties !== undefined && {
          properties: dto.properties === null ? null : (dto.properties as Prisma.InputJsonValue),
        }),
        ...(dto.order !== undefined && { order: dto.order }),
      },
    });

    await (this.prisma as any).formExtension.update({
      where: { id: extensionId },
      data: { updated_at: new Date() },
    });

    return { data: this.toFieldEntity(updated) };
  }

  // ── Delete Field ──

  async deleteField(
    extensionId: string,
    fieldId: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    const ext = await (this.prisma as any).formExtension.findUnique({
      where: { id: extensionId },
    });
    if (!ext) {
      throw new HttpError(404, `Extension ${extensionId} not found`);
    }
    if (ext.status !== 'DRAFT') {
      throw new HttpError(400, `Cannot delete fields from extension in status ${ext.status}`);
    }

    this.verifyExtensionPermission(user, ext.tenant_id, ext.level);

    const field = await (this.prisma as any).formExtensionField.findUnique({
      where: { id: fieldId },
    });
    if (!field || field.extension_id !== extensionId) {
      throw new HttpError(404, `Field ${fieldId} not found in extension ${extensionId}`);
    }

    await (this.prisma as any).formExtensionField.delete({ where: { id: fieldId } });

    await (this.prisma as any).formExtension.update({
      where: { id: extensionId },
      data: { updated_at: new Date() },
    });
  }

  // ── Submit (DRAFT → PENDING_VALIDATION) ──

  async submit(
    extensionId: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<FormExtensionEntity>> {
    const ext = await (this.prisma as any).formExtension.findUnique({
      where: { id: extensionId },
      include: { fields: { orderBy: { order: 'asc' } } },
    });
    if (!ext) {
      throw new HttpError(404, `Extension ${extensionId} not found`);
    }
    if (ext.status !== 'DRAFT') {
      throw new HttpError(400, `Can only submit DRAFT extensions. Current status: ${ext.status}`);
    }
    if (!ext.fields || ext.fields.length === 0) {
      throw new HttpError(400, 'Cannot submit an extension with no fields');
    }

    this.verifyExtensionPermission(user, ext.tenant_id, ext.level);

    const updated = await (this.prisma as any).formExtension.update({
      where: { id: extensionId },
      data: { status: 'PENDING_VALIDATION' },
      include: { fields: { orderBy: { order: 'asc' } } },
    });

    await this.publishEvent(TOPIC_MS_FORMBUILDER_EXTENSION_SUBMITTED, {
      extensionId: ext.id,
      baseFormId: ext.base_form_id,
      baseFormVersion: ext.base_form_version,
      campaignId: ext.campaign_id,
      level: ext.level,
      tenantId: ext.tenant_id,
      version: ext.version,
      fieldCount: ext.fields.length,
    }, user);

    return { data: this.toEntity(updated) };
  }

  // ── Publish (PENDING_VALIDATION → PUBLISHED) ──

  async publish(
    extensionId: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<FormExtensionEntity>> {
    const ext = await (this.prisma as any).formExtension.findUnique({
      where: { id: extensionId },
      include: { fields: { orderBy: { order: 'asc' } } },
    });
    if (!ext) {
      throw new HttpError(404, `Extension ${extensionId} not found`);
    }
    if (ext.status !== 'PENDING_VALIDATION') {
      throw new HttpError(400, `Can only publish PENDING_VALIDATION extensions. Current status: ${ext.status}`);
    }

    // Only continental/REC admins or the tenant's own admin can validate
    this.verifyValidationPermission(user, ext.tenant_id, ext.level);

    // Archive any previously published extension for the same scope
    await (this.prisma as any).formExtension.updateMany({
      where: {
        base_form_id: ext.base_form_id,
        campaign_id: ext.campaign_id,
        level: ext.level,
        tenant_id: ext.tenant_id,
        status: 'PUBLISHED',
        id: { not: extensionId },
      },
      data: { status: 'ARCHIVED' },
    });

    const updated = await (this.prisma as any).formExtension.update({
      where: { id: extensionId },
      data: {
        status: 'PUBLISHED',
        validated_by: user.userId,
      },
      include: { fields: { orderBy: { order: 'asc' } } },
    });

    await this.publishEvent(TOPIC_MS_FORMBUILDER_EXTENSION_PUBLISHED, {
      extensionId: ext.id,
      baseFormId: ext.base_form_id,
      baseFormVersion: ext.base_form_version,
      campaignId: ext.campaign_id,
      level: ext.level,
      tenantId: ext.tenant_id,
      version: ext.version,
      fields: ext.fields.map((f: any) => ({
        fieldKey: f.field_key,
        type: f.type,
        required: f.required,
      })),
    }, user);

    return { data: this.toEntity(updated) };
  }

  // ── Effective Form ──

  async getEffectiveForm(
    campaignId: string,
    baseFormId: string,
    tenantId: string,
    user: AuthenticatedUser,
  ): Promise<EffectiveForm> {
    // 1. Get the base form template
    const template = await (this.prisma as any).formTemplate.findUnique({
      where: { id: baseFormId },
    });
    if (!template) {
      throw new HttpError(404, `Base form ${baseFormId} not found`);
    }

    // 2. Extract base fields
    const schema = template.schema as Record<string, unknown>;
    const rawBaseFields = this.resolver.extractFields(schema);

    const baseFields: EffectiveField[] = rawBaseFields.map((f, i) => ({
      id: f.id,
      fieldKey: (f as any).code ?? f.id,
      label: f.label,
      type: f.type,
      required: f.required ?? false,
      order: f.order ?? i,
      origin: 'base' as const,
      locked: true,
      section: f.section,
      validation: f.validation,
      properties: f.properties as unknown,
    }));

    // 3. Find the published extension for this tenant+campaign
    // Determine tenant hierarchy to find applicable extensions
    const chain = await this.resolver.getTenantHierarchy(tenantId);
    const applicableExtensions: any[] = [];

    // REC-level extension (if tenant is a REC or a country within a REC)
    if (chain.rec) {
      const recExt = await (this.prisma as any).formExtension.findFirst({
        where: {
          base_form_id: baseFormId,
          campaign_id: campaignId,
          level: 'REC',
          tenant_id: chain.rec,
          status: 'PUBLISHED',
        },
        orderBy: { version: 'desc' },
        include: { fields: { orderBy: { order: 'asc' } } },
      });
      if (recExt) applicableExtensions.push(recExt);
    }

    // Country-level extension
    if (chain.country) {
      const countryExt = await (this.prisma as any).formExtension.findFirst({
        where: {
          base_form_id: baseFormId,
          campaign_id: campaignId,
          level: 'COUNTRY',
          tenant_id: chain.country,
          status: 'PUBLISHED',
        },
        orderBy: { version: 'desc' },
        include: { fields: { orderBy: { order: 'asc' } } },
      });
      if (countryExt) applicableExtensions.push(countryExt);
    }

    // 4. Merge extension fields
    const baseFieldKeys = new Set(baseFields.map(f => f.fieldKey));
    const extensionFields: EffectiveField[] = [];
    let primaryExtension: any = null;

    for (const ext of applicableExtensions) {
      primaryExtension = ext; // last one wins for metadata
      for (const field of ext.fields) {
        // Skip if key conflicts with base (should not happen if conflict detection is correct)
        if (baseFieldKeys.has(field.field_key)) continue;
        // Skip if already added by higher-level extension
        if (extensionFields.some(ef => ef.fieldKey === field.field_key)) continue;

        extensionFields.push({
          id: field.id,
          fieldKey: field.field_key,
          label: field.label_i18n,
          type: field.type,
          required: field.required,
          order: baseFields.length + field.order,
          origin: 'extension',
          locked: false,
          validation: field.validation_rules,
          properties: field.properties,
          referenceDataId: field.reference_data_id,
        });
      }
    }

    // 5. Combine: base fields first (locked), then extension fields
    const allFields = [
      ...baseFields,
      ...extensionFields.sort((a, b) => a.order - b.order),
    ];

    return {
      template: {
        id: template.id,
        name: template.name,
        version: template.version,
        schema: template.schema,
      },
      baseFields,
      extensionFields,
      allFields,
      extension: primaryExtension
        ? {
            id: primaryExtension.id,
            level: primaryExtension.level,
            tenantId: primaryExtension.tenant_id,
            version: primaryExtension.version,
          }
        : null,
    };
  }

  // ── Conflict Detection ──

  /**
   * Reject if fieldKey collides with:
   * 1. Any field code/key in the base form template
   * 2. Any field key in a PUBLISHED extension of a higher level for the same campaign
   */
  private async detectFieldKeyConflict(
    ext: any,
    fieldKey: string,
  ): Promise<void> {
    // 1. Check collision with base form fields
    const template = await (this.prisma as any).formTemplate.findUnique({
      where: { id: ext.base_form_id },
    });
    if (template) {
      const schema = template.schema as Record<string, unknown>;
      const baseFields = this.resolver.extractFields(schema);
      const baseFieldKeys = new Set(baseFields.map(f => f.code ?? f.id));
      if (baseFieldKeys.has(fieldKey)) {
        throw new HttpError(
          409,
          `Field key "${fieldKey}" conflicts with an existing base form field. Extension fields must use unique keys.`,
        );
      }
    }

    // 2. Check collision with higher-level published extensions for the same campaign
    if (ext.level === 'COUNTRY') {
      // Country extensions cannot collide with REC extensions
      const recExtensions = await (this.prisma as any).formExtension.findMany({
        where: {
          base_form_id: ext.base_form_id,
          campaign_id: ext.campaign_id,
          level: 'REC',
          status: 'PUBLISHED',
        },
        include: { fields: true },
      });

      for (const recExt of recExtensions) {
        const recFieldKeys = new Set(recExt.fields.map((f: any) => f.field_key));
        if (recFieldKeys.has(fieldKey)) {
          throw new HttpError(
            409,
            `Field key "${fieldKey}" conflicts with a published REC extension field. Country extensions must not duplicate REC extension keys.`,
          );
        }
      }
    }

    // 3. Check collision within the same extension
    const existingInExt = await (this.prisma as any).formExtensionField.findUnique({
      where: {
        extension_id_field_key: {
          extension_id: ext.id,
          field_key: fieldKey,
        },
      },
    });
    if (existingInExt) {
      throw new HttpError(409, `Field key "${fieldKey}" already exists in this extension.`);
    }
  }

  // ── Permission Checks ──

  private verifyExtensionPermission(
    user: AuthenticatedUser,
    targetTenantId: string,
    level: string,
  ): void {
    if (user.tenantLevel === TenantLevel.CONTINENTAL) return;

    if (user.tenantLevel === TenantLevel.REC) {
      if (level !== 'REC' || targetTenantId !== user.tenantId) {
        throw new HttpError(403, 'REC admin can only manage extensions for their own REC');
      }
      return;
    }

    if (user.tenantLevel === TenantLevel.MEMBER_STATE) {
      if (level !== 'COUNTRY' || targetTenantId !== user.tenantId) {
        throw new HttpError(403, 'National admin can only manage extensions for their own country');
      }
      return;
    }

    throw new HttpError(403, 'Insufficient permissions to manage form extensions');
  }

  private verifyValidationPermission(
    user: AuthenticatedUser,
    targetTenantId: string,
    level: string,
  ): void {
    // Continental admin can validate anything
    if (user.tenantLevel === TenantLevel.CONTINENTAL) return;

    // REC admin can validate REC extensions for their own REC
    // and COUNTRY extensions for countries within their REC
    if (user.tenantLevel === TenantLevel.REC) {
      if (level === 'REC' && targetTenantId === user.tenantId) return;
      // For country-level, check if the country is within this REC
      if (level === 'COUNTRY') {
        // Simplified: allow REC admin to validate country extensions
        // (full check would verify tenant hierarchy)
        return;
      }
    }

    // National admin can validate their own country's extensions
    if (user.tenantLevel === TenantLevel.MEMBER_STATE) {
      if (level === 'COUNTRY' && targetTenantId === user.tenantId) return;
    }

    throw new HttpError(403, 'Insufficient permissions to validate this extension');
  }

  private verifyReadAccess(user: AuthenticatedUser, tenantId: string): void {
    if (user.tenantLevel === TenantLevel.CONTINENTAL) return;
    if (tenantId === user.tenantId) return;
    throw new HttpError(404, 'Extension not found');
  }

  // ── Kafka Events ──

  private async publishEvent(
    topic: string,
    payload: Record<string, unknown>,
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
      const key = (payload['tenantId'] as string) ?? user.tenantId;
      await Promise.race([
        this.kafkaProducer.send(topic, key, payload, headers),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Kafka publish timeout')), 5000),
        ),
      ]);
    } catch (error) {
      console.error(
        `[ExtensionService] Failed to publish ${topic}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // ── Mapping ──

  private toEntity(row: any): FormExtensionEntity {
    return {
      id: row.id,
      baseFormId: row.base_form_id,
      baseFormVersion: row.base_form_version,
      campaignId: row.campaign_id,
      level: row.level,
      tenantId: row.tenant_id,
      version: row.version,
      status: row.status,
      createdBy: row.created_by,
      validatedBy: row.validated_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      fields: (row.fields ?? []).map((f: any) => this.toFieldEntity(f)),
    };
  }

  private toFieldEntity(row: any): FormExtensionFieldEntity {
    return {
      id: row.id,
      extensionId: row.extension_id,
      fieldKey: row.field_key,
      labelI18n: row.label_i18n as Record<string, string>,
      type: row.type,
      required: row.required,
      validationRules: row.validation_rules,
      referenceDataId: row.reference_data_id,
      properties: row.properties,
      order: row.order,
      createdAt: row.created_at,
    };
  }
}

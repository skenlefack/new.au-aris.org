import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import type { Prisma } from '@prisma/client';
import { KafkaProducerService } from '@aris/kafka-client';
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
import { PrismaService } from '../prisma.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import type { FormTemplateEntity } from './entities/template.entity';

const SERVICE_NAME = 'form-builder-service';

@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafkaProducer: KafkaProducerService,
  ) {}

  async create(
    dto: CreateTemplateDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<FormTemplateEntity>> {
    // Validate parent template exists if provided
    if (dto.parentTemplateId) {
      const parent = await this.prisma.formTemplate.findUnique({
        where: { id: dto.parentTemplateId },
      });
      if (!parent) {
        throw new NotFoundException(
          `Parent template ${dto.parentTemplateId} not found`,
        );
      }
    }

    // Check for duplicate name+version within this tenant
    const existing = await this.prisma.formTemplate.findFirst({
      where: {
        tenant_id: user.tenantId,
        name: dto.name,
        version: 1,
      },
    });
    if (existing) {
      throw new ConflictException(
        `Template "${dto.name}" version 1 already exists for this tenant`,
      );
    }

    const template = await this.prisma.formTemplate.create({
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

    this.logger.log(`Template created: ${template.name} v${template.version} (${template.id})`);
    return { data: this.toEntity(template) };
  }

  async findAll(
    user: AuthenticatedUser,
    query: PaginationQuery & { domain?: string; status?: string },
  ): Promise<PaginatedResponse<FormTemplateEntity>> {
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
      this.prisma.formTemplate.findMany({ where, skip, take: limit, orderBy }),
      this.prisma.formTemplate.count({ where }),
    ]);

    return {
      data: data.map((t) => this.toEntity(t)),
      meta: { total, page, limit },
    };
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<FormTemplateEntity>> {
    const template = await this.prisma.formTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException(`Template ${id} not found`);
    }

    this.verifyTenantAccess(user, template.tenant_id);

    // Resolve inheritance: merge parent schema into this template
    const resolved = await this.resolveInheritance(template);
    return { data: resolved };
  }

  async update(
    id: string,
    dto: UpdateTemplateDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<FormTemplateEntity>> {
    const existing = await this.prisma.formTemplate.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Template ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenant_id);

    if (existing.status === 'ARCHIVED') {
      throw new BadRequestException('Cannot update an archived template');
    }

    // If template is PUBLISHED, updates create a new DRAFT version
    if (existing.status === 'PUBLISHED') {
      return this.createNewVersion(existing, dto, user);
    }

    // If DRAFT, update in place
    const template = await this.prisma.formTemplate.update({
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

    this.logger.log(`Template updated: ${template.name} v${template.version} (${template.id})`);
    return { data: this.toEntity(template) };
  }

  async publish(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<FormTemplateEntity>> {
    const existing = await this.prisma.formTemplate.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Template ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenant_id);

    if (existing.status !== 'DRAFT') {
      throw new BadRequestException(
        `Only DRAFT templates can be published (current: ${existing.status})`,
      );
    }

    const template = await this.prisma.formTemplate.update({
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

    this.logger.log(`Template published: ${template.name} v${template.version} (${template.id})`);
    return { data: this.toEntity(template) };
  }

  async archive(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<FormTemplateEntity>> {
    const existing = await this.prisma.formTemplate.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Template ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenant_id);

    if (existing.status === 'ARCHIVED') {
      throw new BadRequestException('Template is already archived');
    }

    const template = await this.prisma.formTemplate.update({
      where: { id },
      data: {
        status: 'ARCHIVED',
        archived_at: new Date(),
        updated_by: user.userId,
      },
    });

    this.logger.log(`Template archived: ${template.name} v${template.version} (${template.id})`);
    return { data: this.toEntity(template) };
  }

  async preview(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<FormTemplateEntity>> {
    // Preview returns the resolved template identical to findOne
    return this.findOne(id, user);
  }

  // ── Inheritance Resolution ──

  /**
   * Resolves template inheritance by walking up the parent chain and
   * deep-merging schemas. Child fields override parent fields.
   * The UI schema is merged similarly.
   */
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

    // Collect ancestor chain (child → parent → grandparent → ...)
    const chain = await this.getInheritanceChain(template.parent_template_id);

    // Merge from root ancestor down to parent, then overlay child
    let mergedSchema: Record<string, unknown> = {};
    let mergedUiSchema: Record<string, unknown> = {};

    // Apply ancestors from root → leaf order
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

    // Overlay current template on top
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
      throw new BadRequestException('Circular inheritance detected');
    }
    visited.add(parentId);

    const parent = await this.prisma.formTemplate.findUnique({
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

  /**
   * Deep-merge two JSON Schema objects. Child properties override parent.
   * For "properties" objects, individual property definitions are merged.
   * For "required" arrays, values are concatenated and deduplicated.
   */
  deepMergeSchema(
    parent: Record<string, unknown>,
    child: Record<string, unknown>,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = { ...parent };

    for (const key of Object.keys(child)) {
      const parentVal = parent[key];
      const childVal = child[key];

      if (key === 'required' && Array.isArray(parentVal) && Array.isArray(childVal)) {
        // Merge required arrays with deduplication
        result[key] = [...new Set([...parentVal, ...childVal])];
      } else if (key === 'properties' && isPlainObject(parentVal) && isPlainObject(childVal)) {
        // Deep merge properties
        result[key] = this.deepMergeSchema(
          parentVal as Record<string, unknown>,
          childVal as Record<string, unknown>,
        );
      } else {
        // Child overrides parent
        result[key] = childVal;
      }
    }

    return result;
  }

  // ── Version Management ──

  /**
   * Creates a new DRAFT version when a PUBLISHED template is updated.
   * The new version inherits the existing template's fields, overlaid with dto changes.
   */
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
    dto: UpdateTemplateDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<FormTemplateEntity>> {
    // Find the highest version for this template name + tenant
    const latest = await this.prisma.formTemplate.findFirst({
      where: {
        tenant_id: existing.tenant_id,
        name: existing.name,
      },
      orderBy: { version: 'desc' },
    });

    const nextVersion = (latest?.version ?? existing.version) + 1;

    const template = await this.prisma.formTemplate.create({
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

    this.logger.log(
      `New version created: ${template.name} v${template.version} (${template.id}) from v${existing.version}`,
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
        // REC sees own templates + published templates from AU-IBAR (parent)
        return {
          OR: [
            { tenant_id: user.tenantId },
            { status: 'PUBLISHED' },
          ],
        };
      case TenantLevel.MEMBER_STATE:
        // MS sees own templates + published templates (from parent REC/AU)
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
    // CONTINENTAL can access everything
    if (user.tenantLevel === TenantLevel.CONTINENTAL) {
      return;
    }

    // Own tenant always OK
    if (templateTenantId === user.tenantId) {
      return;
    }

    // Published templates are accessible to all (for inheritance)
    // For non-own, non-published, deny
    throw new NotFoundException('Template not found');
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
      this.logger.error(
        `Failed to publish ${topic} for template ${template.id}`,
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

import { v4 as uuidv4 } from 'uuid';
import type { PrismaClient, Prisma } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import { TenantLevel, UserRole } from '@aris/shared-types';
import type { KafkaHeaders, ApiResponse, PaginatedResponse, PaginationQuery } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { FormResolverService, ResolverError } from './form-resolver.service';
import type { FieldOverride, SectionOverride, ResolvedForm, FormDiff, HierarchyNode } from './form-resolver.service';

const SERVICE_NAME = 'form-builder-service';

// ── Kafka Topics ──
const TOPIC_OVERLAY_CREATED = 'ms.formbuilder.overlay.created.v1';
const TOPIC_OVERLAY_UPDATED = 'ms.formbuilder.overlay.updated.v1';
const TOPIC_OVERLAY_DELETED = 'ms.formbuilder.overlay.deleted.v1';
const TOPIC_OVERLAY_CONFLICT = 'ms.formbuilder.overlay.conflict.v1';
const TOPIC_TEMPLATE_UPDATED_V2 = 'ms.formbuilder.template.updated.v2';

// ── Error ──
class HttpError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

// ── Overlay Entity ──
export interface FormOverlayEntity {
  id: string;
  templateId: string;
  templateVersion: number;
  tenantId: string;
  tenantLevel: string;
  parentOverlayId: string | null;
  fieldOverrides: FieldOverride[];
  sectionOverrides: SectionOverride[] | null;
  metadataOverrides: unknown | null;
  isActive: boolean;
  needsReview: boolean;
  createdBy: string;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ── Version History Entity ──
export interface FormVersionHistoryEntity {
  id: string;
  templateId: string;
  overlayId: string | null;
  version: number;
  changeType: string;
  changeDelta: unknown;
  changedBy: string;
  tenantId: string;
  createdAt: Date;
}

// ── Service ──

export class OverlayService {
  private readonly resolver: FormResolverService;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafkaProducer: StandaloneKafkaProducer,
  ) {
    this.resolver = new FormResolverService(prisma);
  }

  // ── Create Overlay ──

  async createOverlay(
    templateId: string,
    dto: {
      tenantId: string;
      tenantLevel: string;
      fieldOverrides: FieldOverride[];
      sectionOverrides?: SectionOverride[];
      metadataOverrides?: unknown;
    },
    user: AuthenticatedUser,
  ): Promise<ApiResponse<FormOverlayEntity>> {
    // Validate template exists
    const template = await (this.prisma as any).formTemplate.findUnique({
      where: { id: templateId },
    });
    if (!template) {
      throw new HttpError(404, `Template ${templateId} not found`);
    }

    // Validate tenant level
    if (dto.tenantLevel !== TenantLevel.REC && dto.tenantLevel !== TenantLevel.MEMBER_STATE) {
      throw new HttpError(400, 'Overlay tenant level must be REC or MEMBER_STATE');
    }

    // Validate RBAC: user can only create overlays for their own tenant
    this.verifyOverlayPermission(user, dto.tenantId, dto.tenantLevel);

    // Check for existing overlay (unique constraint)
    const existing = await (this.prisma as any).formOverlay.findUnique({
      where: {
        template_id_tenant_id: {
          template_id: templateId,
          tenant_id: dto.tenantId,
        },
      },
    });
    if (existing) {
      throw new HttpError(409, `Overlay already exists for tenant ${dto.tenantId} on template ${templateId}`);
    }

    // Validate field overrides reference valid fields
    this.validateFieldOverrides(template, dto.fieldOverrides);

    // Find parent overlay (REC overlay if this is a COUNTRY creating overlay)
    let parentOverlayId: string | null = null;
    if (dto.tenantLevel === TenantLevel.MEMBER_STATE) {
      const chain = await this.resolver.getTenantHierarchy(dto.tenantId);
      if (chain.rec) {
        const recOverlay = await (this.prisma as any).formOverlay.findUnique({
          where: {
            template_id_tenant_id: {
              template_id: templateId,
              tenant_id: chain.rec,
            },
          },
        });
        if (recOverlay) {
          parentOverlayId = recOverlay.id;
        }
      }
    }

    const overlay = await (this.prisma as any).formOverlay.create({
      data: {
        template_id: templateId,
        template_version: template.version,
        tenant_id: dto.tenantId,
        tenant_level: dto.tenantLevel,
        parent_overlay_id: parentOverlayId,
        field_overrides: dto.fieldOverrides as unknown as Prisma.InputJsonValue,
        section_overrides: dto.sectionOverrides
          ? (dto.sectionOverrides as unknown as Prisma.InputJsonValue)
          : undefined,
        metadata_overrides: dto.metadataOverrides
          ? (dto.metadataOverrides as Prisma.InputJsonValue)
          : undefined,
        is_active: true,
        needs_review: false,
        created_by: user.userId,
      },
    });

    // Record history
    await this.recordHistory({
      templateId,
      overlayId: overlay.id,
      version: template.version,
      changeType: 'OVERLAY_CREATED',
      changeDelta: { fieldOverrides: dto.fieldOverrides },
      changedBy: user.userId,
      tenantId: dto.tenantId,
    });

    // Publish Kafka event
    await this.publishEvent(TOPIC_OVERLAY_CREATED, overlay, user);

    return { data: this.toEntity(overlay) };
  }

  // ── Update Overlay ──

  async updateOverlay(
    templateId: string,
    overlayId: string,
    dto: {
      fieldOverrides?: FieldOverride[];
      sectionOverrides?: SectionOverride[];
      metadataOverrides?: unknown;
    },
    user: AuthenticatedUser,
  ): Promise<ApiResponse<FormOverlayEntity>> {
    const overlay = await (this.prisma as any).formOverlay.findUnique({
      where: { id: overlayId },
    });
    if (!overlay || overlay.template_id !== templateId) {
      throw new HttpError(404, `Overlay ${overlayId} not found for template ${templateId}`);
    }

    this.verifyOverlayPermission(user, overlay.tenant_id, overlay.tenant_level);

    if (dto.fieldOverrides) {
      const template = await (this.prisma as any).formTemplate.findUnique({
        where: { id: templateId },
      });
      if (template) {
        this.validateFieldOverrides(template, dto.fieldOverrides);
      }
    }

    const updated = await (this.prisma as any).formOverlay.update({
      where: { id: overlayId },
      data: {
        ...(dto.fieldOverrides && {
          field_overrides: dto.fieldOverrides as unknown as Prisma.InputJsonValue,
        }),
        ...(dto.sectionOverrides !== undefined && {
          section_overrides: dto.sectionOverrides as unknown as Prisma.InputJsonValue,
        }),
        ...(dto.metadataOverrides !== undefined && {
          metadata_overrides: dto.metadataOverrides as Prisma.InputJsonValue,
        }),
        needs_review: false,
        updated_by: user.userId,
      },
    });

    await this.recordHistory({
      templateId,
      overlayId,
      version: overlay.template_version,
      changeType: 'OVERLAY_UPDATED',
      changeDelta: {
        fieldOverrides: dto.fieldOverrides ?? overlay.field_overrides,
        previousOverrides: overlay.field_overrides,
      },
      changedBy: user.userId,
      tenantId: overlay.tenant_id,
    });

    await this.publishEvent(TOPIC_OVERLAY_UPDATED, updated, user);

    return { data: this.toEntity(updated) };
  }

  // ── Delete Overlay ──

  async deleteOverlay(
    templateId: string,
    overlayId: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    const overlay = await (this.prisma as any).formOverlay.findUnique({
      where: { id: overlayId },
    });
    if (!overlay || overlay.template_id !== templateId) {
      throw new HttpError(404, `Overlay ${overlayId} not found for template ${templateId}`);
    }

    this.verifyOverlayPermission(user, overlay.tenant_id, overlay.tenant_level);

    // If deleting a REC overlay, also remove child country overlays that depend on it
    if (overlay.tenant_level === TenantLevel.REC) {
      await (this.prisma as any).formOverlay.updateMany({
        where: { parent_overlay_id: overlayId },
        data: { parent_overlay_id: null },
      });
    }

    await (this.prisma as any).formOverlay.delete({ where: { id: overlayId } });

    await this.recordHistory({
      templateId,
      overlayId,
      version: overlay.template_version,
      changeType: 'OVERLAY_DELETED',
      changeDelta: { deletedOverrides: overlay.field_overrides },
      changedBy: user.userId,
      tenantId: overlay.tenant_id,
    });

    await this.publishEvent(TOPIC_OVERLAY_DELETED, { ...overlay, deleted: true }, user);
  }

  // ── Get Overlay ──

  async getOverlay(
    templateId: string,
    overlayId: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<FormOverlayEntity>> {
    const overlay = await (this.prisma as any).formOverlay.findUnique({
      where: { id: overlayId },
    });
    if (!overlay || overlay.template_id !== templateId) {
      throw new HttpError(404, `Overlay ${overlayId} not found for template ${templateId}`);
    }

    this.verifyOverlayReadAccess(user, overlay.tenant_id);

    return { data: this.toEntity(overlay) };
  }

  // ── List Overlays ──

  async listOverlays(
    templateId: string,
    user: AuthenticatedUser,
    query: PaginationQuery & { tenantLevel?: string },
  ): Promise<PaginatedResponse<FormOverlayEntity>> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: any = {
      template_id: templateId,
      ...(query.tenantLevel && { tenant_level: query.tenantLevel }),
    };

    // Non-continental users can only see overlays for their own tenant or children
    if (user.tenantLevel !== TenantLevel.CONTINENTAL) {
      where.tenant_id = user.tenantId;
    }

    const [data, total] = await Promise.all([
      (this.prisma as any).formOverlay.findMany({ where, skip, take: limit, orderBy: { created_at: 'asc' } }),
      (this.prisma as any).formOverlay.count({ where }),
    ]);

    return {
      data: data.map((o: any) => this.toEntity(o)),
      meta: { total, page, limit },
    };
  }

  // ── Resolve Form (delegates to FormResolverService) ──

  async resolveForm(templateId: string, tenantId: string): Promise<ResolvedForm> {
    return this.resolver.resolveForm(templateId, tenantId);
  }

  // ── Diff ──

  async computeDiff(templateId: string, tenantId: string): Promise<FormDiff> {
    return this.resolver.computeDiff(templateId, tenantId);
  }

  // ── Hierarchy ──

  async getHierarchy(templateId: string): Promise<HierarchyNode> {
    return this.resolver.getHierarchy(templateId);
  }

  // ── History ──

  async getHistory(
    templateId: string,
    query: PaginationQuery,
  ): Promise<PaginatedResponse<FormVersionHistoryEntity>> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where = { template_id: templateId };

    const [data, total] = await Promise.all([
      (this.prisma as any).formVersionHistory.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      (this.prisma as any).formVersionHistory.count({ where }),
    ]);

    return {
      data: data.map((h: any) => this.toHistoryEntity(h)),
      meta: { total, page, limit },
    };
  }

  // ── Propagation ──

  /**
   * When a continental template base is updated, check all overlays and flag conflicts.
   */
  async propagateBaseUpdate(
    templateId: string,
    modifiedFieldIds: string[],
    user: AuthenticatedUser,
  ): Promise<{
    totalOverlays: number;
    conflicting: Array<{ overlayId: string; tenantId: string; conflictingFields: string[] }>;
    unaffected: number;
  }> {
    const overlays = await (this.prisma as any).formOverlay.findMany({
      where: { template_id: templateId, is_active: true },
    });

    const conflicts: Array<{ overlayId: string; tenantId: string; conflictingFields: string[] }> = [];
    let unaffected = 0;

    for (const overlay of overlays) {
      const overrides = overlay.field_overrides as FieldOverride[];
      const overriddenFieldIds = overrides.map((o: FieldOverride) => o.fieldId);
      const conflictingFields = modifiedFieldIds.filter(id => overriddenFieldIds.includes(id));

      if (conflictingFields.length > 0) {
        // Mark overlay as needs review
        await (this.prisma as any).formOverlay.update({
          where: { id: overlay.id },
          data: { needs_review: true },
        });

        conflicts.push({
          overlayId: overlay.id,
          tenantId: overlay.tenant_id,
          conflictingFields,
        });

        // Publish conflict event
        await this.publishEvent(TOPIC_OVERLAY_CONFLICT, {
          templateId,
          overlayId: overlay.id,
          tenantId: overlay.tenant_id,
          conflictingFields,
        }, user);
      } else {
        unaffected++;
      }
    }

    // Publish template updated v2 event
    await this.publishEvent(TOPIC_TEMPLATE_UPDATED_V2, {
      templateId,
      modifiedFieldIds,
      conflictingOverlays: conflicts.map(c => c.overlayId),
    }, user);

    // Record history
    await this.recordHistory({
      templateId,
      overlayId: null,
      version: 0, // will be set by caller
      changeType: 'BASE_UPDATED',
      changeDelta: {
        modifiedFieldIds,
        conflictCount: conflicts.length,
        unaffectedCount: unaffected,
      },
      changedBy: user.userId,
      tenantId: user.tenantId,
    });

    return {
      totalOverlays: overlays.length,
      conflicting: conflicts,
      unaffected,
    };
  }

  // ── Validation ──

  private validateFieldOverrides(
    template: { schema: unknown },
    overrides: FieldOverride[],
  ): void {
    const schema = template.schema as Record<string, unknown>;
    const existingFields = this.resolver.extractFields(schema);
    const existingFieldIds = new Set(existingFields.map(f => f.id));

    for (const override of overrides) {
      if (override.action === 'ADD') {
        // ADD doesn't need to reference an existing field
        if (!override.data || typeof override.data !== 'object') {
          throw new HttpError(400, `ADD override for field ${override.fieldId} must include data`);
        }
        continue;
      }

      // MODIFY, REMOVE, REORDER must reference existing fields
      if (!existingFieldIds.has(override.fieldId)) {
        throw new HttpError(400, `Field ${override.fieldId} not found in template. Cannot ${override.action}`);
      }
    }
  }

  private verifyOverlayPermission(
    user: AuthenticatedUser,
    targetTenantId: string,
    targetTenantLevel: string,
  ): void {
    // Continental admin can do anything
    if (user.tenantLevel === TenantLevel.CONTINENTAL) {
      return;
    }

    // REC admin can only create overlays for their own REC
    if (user.tenantLevel === TenantLevel.REC) {
      if (targetTenantLevel !== TenantLevel.REC || targetTenantId !== user.tenantId) {
        throw new HttpError(403, 'REC admin can only manage overlays for their own REC');
      }
      return;
    }

    // National admin can only create overlays for their own country
    if (user.tenantLevel === TenantLevel.MEMBER_STATE) {
      if (targetTenantLevel !== TenantLevel.MEMBER_STATE || targetTenantId !== user.tenantId) {
        throw new HttpError(403, 'National admin can only manage overlays for their own country');
      }
      return;
    }

    throw new HttpError(403, 'Insufficient permissions to manage overlays');
  }

  private verifyOverlayReadAccess(
    user: AuthenticatedUser,
    overlayTenantId: string,
  ): void {
    if (user.tenantLevel === TenantLevel.CONTINENTAL) return;
    if (overlayTenantId === user.tenantId) return;
    throw new HttpError(404, 'Overlay not found');
  }

  // ── History Recording ──

  private async recordHistory(entry: {
    templateId: string;
    overlayId: string | null;
    version: number;
    changeType: string;
    changeDelta: unknown;
    changedBy: string;
    tenantId: string;
  }): Promise<void> {
    try {
      await (this.prisma as any).formVersionHistory.create({
        data: {
          template_id: entry.templateId,
          overlay_id: entry.overlayId,
          version: entry.version,
          change_type: entry.changeType,
          change_delta: entry.changeDelta as Prisma.InputJsonValue,
          changed_by: entry.changedBy,
          tenant_id: entry.tenantId,
        },
      });
    } catch (error) {
      console.error('[OverlayService] Failed to record history', error);
    }
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
      const key = (payload['id'] as string) ?? (payload['overlayId'] as string) ?? uuidv4();
      await this.kafkaProducer.send(topic, key, payload, headers);
    } catch (error) {
      console.error(
        `[OverlayService] Failed to publish ${topic}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // ── Mapping ──

  private toEntity(row: any): FormOverlayEntity {
    return {
      id: row.id,
      templateId: row.template_id,
      templateVersion: row.template_version,
      tenantId: row.tenant_id,
      tenantLevel: row.tenant_level,
      parentOverlayId: row.parent_overlay_id,
      fieldOverrides: row.field_overrides as FieldOverride[],
      sectionOverrides: row.section_overrides as SectionOverride[] | null,
      metadataOverrides: row.metadata_overrides,
      isActive: row.is_active,
      needsReview: row.needs_review,
      createdBy: row.created_by,
      updatedBy: row.updated_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private toHistoryEntity(row: any): FormVersionHistoryEntity {
    return {
      id: row.id,
      templateId: row.template_id,
      overlayId: row.overlay_id,
      version: row.version,
      changeType: row.change_type,
      changeDelta: row.change_delta,
      changedBy: row.changed_by,
      tenantId: row.tenant_id,
      createdAt: row.created_at,
    };
  }
}

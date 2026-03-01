import type { PrismaClient } from '@prisma/client';
import { TenantLevel } from '@aris/shared-types';

// ── Types ──

export interface Field {
  id: string;
  type: string;
  label: unknown;
  order: number;
  required?: boolean;
  validation?: unknown;
  options?: unknown;
  section?: string;
  hidden?: boolean;
  [key: string]: unknown;
}

export interface Section {
  id: string;
  title: unknown;
  order: number;
  description?: unknown;
  [key: string]: unknown;
}

export interface FieldOverride {
  fieldId: string;
  action: 'MODIFY' | 'ADD' | 'REMOVE' | 'REORDER';
  data: Record<string, unknown>;
}

export interface SectionOverride {
  sectionId: string;
  action: 'MODIFY' | 'ADD' | 'REMOVE' | 'REORDER';
  data: Record<string, unknown>;
}

export interface TenantChain {
  continental: string;
  rec: string | null;
  country: string | null;
}

export interface ResolvedForm {
  template: {
    id: string;
    name: string;
    version: number;
    status: string;
    schema: unknown;
    [key: string]: unknown;
  };
  appliedOverlays: Array<{
    id: string;
    tenantId: string;
    tenantLevel: string;
    fieldOverrides: FieldOverride[];
    [key: string]: unknown;
  }>;
  resolvedFields: Field[];
  resolvedSections: Section[];
  inheritance: {
    level: string;
    chain: string[];
  };
}

export interface FormDiff {
  templateId: string;
  tenantId: string;
  baseFields: Field[];
  resolvedFields: Field[];
  changes: Array<{
    fieldId: string;
    action: string;
    source: string; // "REC" or "MEMBER_STATE"
    sourceTenantId: string;
    before: Partial<Field> | null;
    after: Partial<Field> | null;
  }>;
}

export interface HierarchyNode {
  templateId: string;
  templateName: string;
  overlays: Array<{
    id: string;
    tenantId: string;
    tenantLevel: string;
    fieldOverrideCount: number;
    needsReview: boolean;
    children: Array<{
      id: string;
      tenantId: string;
      tenantLevel: string;
      fieldOverrideCount: number;
      needsReview: boolean;
    }>;
  }>;
}

// ── Service ──

export class FormResolverService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Resolve the final form for a given template + tenant.
   * Merges: base continental template → REC overlay → COUNTRY overlay
   */
  async resolveForm(templateId: string, tenantId: string): Promise<ResolvedForm> {
    // 1. Get the base template
    const template = await (this.prisma as any).formTemplate.findUnique({
      where: { id: templateId },
    });
    if (!template) {
      throw new ResolverError(404, `Template ${templateId} not found`);
    }

    // 2. Determine the tenant hierarchy chain
    const chain = await this.getTenantHierarchy(tenantId);

    // 3. Fetch overlays for this chain
    const overlayTenantIds = [chain.rec, chain.country].filter(Boolean) as string[];
    const overlays = overlayTenantIds.length > 0
      ? await (this.prisma as any).formOverlay.findMany({
          where: {
            template_id: templateId,
            tenant_id: { in: overlayTenantIds },
            is_active: true,
          },
          orderBy: { created_at: 'asc' },
        })
      : [];

    // 4. Separate REC and COUNTRY overlays
    const recOverlay = overlays.find((o: any) => o.tenant_level === TenantLevel.REC) ?? null;
    const countryOverlay = overlays.find((o: any) => o.tenant_level === TenantLevel.MEMBER_STATE) ?? null;

    // 5. Extract base fields from template schema
    const schema = template.schema as Record<string, unknown>;
    let fields = this.extractFields(schema);
    let sections = this.extractSections(schema);
    const appliedOverlays: ResolvedForm['appliedOverlays'] = [];

    // 6. Apply REC overlay
    if (recOverlay) {
      const fieldOverrides = (recOverlay.field_overrides ?? []) as FieldOverride[];
      fields = this.applyOverlay(fields, fieldOverrides);
      if (recOverlay.section_overrides) {
        sections = this.applySectionOverlay(sections, recOverlay.section_overrides as SectionOverride[]);
      }
      appliedOverlays.push({
        id: recOverlay.id,
        tenantId: recOverlay.tenant_id,
        tenantLevel: recOverlay.tenant_level,
        fieldOverrides,
      });
    }

    // 7. Apply COUNTRY overlay
    if (countryOverlay) {
      const fieldOverrides = (countryOverlay.field_overrides ?? []) as FieldOverride[];
      fields = this.applyOverlay(fields, fieldOverrides);
      if (countryOverlay.section_overrides) {
        sections = this.applySectionOverlay(sections, countryOverlay.section_overrides as SectionOverride[]);
      }
      appliedOverlays.push({
        id: countryOverlay.id,
        tenantId: countryOverlay.tenant_id,
        tenantLevel: countryOverlay.tenant_level,
        fieldOverrides,
      });
    }

    // 8. Build inheritance chain description
    const chainLabels: string[] = ['CONTINENTAL'];
    if (recOverlay) chainLabels.push(`REC:${recOverlay.tenant_id}`);
    if (countryOverlay) chainLabels.push(`COUNTRY:${countryOverlay.tenant_id}`);

    const level = countryOverlay
      ? TenantLevel.MEMBER_STATE
      : recOverlay
        ? TenantLevel.REC
        : TenantLevel.CONTINENTAL;

    return {
      template: {
        id: template.id,
        name: template.name,
        version: template.version,
        status: template.status,
        schema: template.schema,
        tenant_id: template.tenant_id,
        domain: template.domain,
      },
      appliedOverlays,
      resolvedFields: fields,
      resolvedSections: sections,
      inheritance: {
        level,
        chain: chainLabels,
      },
    };
  }

  /**
   * Compute the diff between base template and resolved form for a tenant.
   */
  async computeDiff(templateId: string, tenantId: string): Promise<FormDiff> {
    const template = await (this.prisma as any).formTemplate.findUnique({
      where: { id: templateId },
    });
    if (!template) {
      throw new ResolverError(404, `Template ${templateId} not found`);
    }

    const baseFields = this.extractFields(template.schema as Record<string, unknown>);
    const resolved = await this.resolveForm(templateId, tenantId);
    const changes: FormDiff['changes'] = [];

    // Detect modifications and removals
    for (const overlay of resolved.appliedOverlays) {
      for (const override of overlay.fieldOverrides) {
        const baseFld = baseFields.find(f => f.id === override.fieldId);
        switch (override.action) {
          case 'MODIFY':
            changes.push({
              fieldId: override.fieldId,
              action: 'MODIFY',
              source: overlay.tenantLevel,
              sourceTenantId: overlay.tenantId,
              before: baseFld ? { ...baseFld } : null,
              after: override.data as Partial<Field>,
            });
            break;
          case 'ADD':
            changes.push({
              fieldId: override.fieldId,
              action: 'ADD',
              source: overlay.tenantLevel,
              sourceTenantId: overlay.tenantId,
              before: null,
              after: override.data as Partial<Field>,
            });
            break;
          case 'REMOVE':
            changes.push({
              fieldId: override.fieldId,
              action: 'REMOVE',
              source: overlay.tenantLevel,
              sourceTenantId: overlay.tenantId,
              before: baseFld ? { ...baseFld } : null,
              after: null,
            });
            break;
          case 'REORDER':
            changes.push({
              fieldId: override.fieldId,
              action: 'REORDER',
              source: overlay.tenantLevel,
              sourceTenantId: overlay.tenantId,
              before: baseFld ? { order: baseFld.order } as Partial<Field> : null,
              after: { order: override.data['order'] as number } as Partial<Field>,
            });
            break;
        }
      }
    }

    return {
      templateId,
      tenantId,
      baseFields,
      resolvedFields: resolved.resolvedFields,
      changes,
    };
  }

  /**
   * Get the hierarchy tree of all overlays for a template.
   */
  async getHierarchy(templateId: string): Promise<HierarchyNode> {
    const template = await (this.prisma as any).formTemplate.findUnique({
      where: { id: templateId },
    });
    if (!template) {
      throw new ResolverError(404, `Template ${templateId} not found`);
    }

    const allOverlays = await (this.prisma as any).formOverlay.findMany({
      where: { template_id: templateId },
      orderBy: { created_at: 'asc' },
    });

    const recOverlays = allOverlays.filter((o: any) => o.tenant_level === TenantLevel.REC);
    const countryOverlays = allOverlays.filter((o: any) => o.tenant_level === TenantLevel.MEMBER_STATE);

    const overlayNodes = recOverlays.map((rec: any) => {
      const children = countryOverlays
        .filter((c: any) => c.parent_overlay_id === rec.id)
        .map((c: any) => ({
          id: c.id,
          tenantId: c.tenant_id,
          tenantLevel: c.tenant_level,
          fieldOverrideCount: Array.isArray(c.field_overrides) ? c.field_overrides.length : 0,
          needsReview: c.needs_review,
        }));

      return {
        id: rec.id,
        tenantId: rec.tenant_id,
        tenantLevel: rec.tenant_level,
        fieldOverrideCount: Array.isArray(rec.field_overrides) ? rec.field_overrides.length : 0,
        needsReview: rec.needs_review,
        children,
      };
    });

    // Add orphan country overlays (countries without a REC overlay)
    const assignedCountryIds = new Set(
      overlayNodes.flatMap((n: any) => n.children.map((c: any) => c.id)),
    );
    const orphanCountries = countryOverlays
      .filter((c: any) => !assignedCountryIds.has(c.id))
      .map((c: any) => ({
        id: c.id,
        tenantId: c.tenant_id,
        tenantLevel: c.tenant_level,
        fieldOverrideCount: Array.isArray(c.field_overrides) ? c.field_overrides.length : 0,
        needsReview: c.needs_review,
        children: [],
      }));

    return {
      templateId,
      templateName: template.name,
      overlays: [...overlayNodes, ...orphanCountries],
    };
  }

  // ── Core merge algorithm ──

  /**
   * Apply overlay field overrides to base fields.
   * Priority: later overlays win.
   */
  applyOverlay(baseFields: Field[], overrides: FieldOverride[]): Field[] {
    const result = deepClone(baseFields);

    for (const override of overrides) {
      switch (override.action) {
        case 'MODIFY': {
          const idx = result.findIndex(f => f.id === override.fieldId);
          if (idx >= 0) {
            result[idx] = { ...result[idx], ...override.data, id: override.fieldId } as Field;
          }
          break;
        }
        case 'ADD': {
          // Don't add if already exists
          const existing = result.findIndex(f => f.id === override.fieldId);
          if (existing < 0) {
            result.push({
              id: override.fieldId,
              type: 'text',
              label: {},
              order: result.length,
              ...override.data,
            } as Field);
          }
          break;
        }
        case 'REMOVE': {
          const rmIdx = result.findIndex(f => f.id === override.fieldId);
          if (rmIdx >= 0) {
            result[rmIdx] = { ...result[rmIdx], hidden: true };
          }
          break;
        }
        case 'REORDER': {
          const roIdx = result.findIndex(f => f.id === override.fieldId);
          if (roIdx >= 0) {
            result[roIdx] = { ...result[roIdx], order: override.data['order'] as number };
          }
          break;
        }
      }
    }

    return result
      .filter(f => !f.hidden)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  applySectionOverlay(baseSections: Section[], overrides: SectionOverride[]): Section[] {
    const result = deepClone(baseSections);

    for (const override of overrides) {
      switch (override.action) {
        case 'MODIFY': {
          const idx = result.findIndex(s => s.id === override.sectionId);
          if (idx >= 0) {
            result[idx] = { ...result[idx], ...override.data, id: override.sectionId } as Section;
          }
          break;
        }
        case 'ADD': {
          const existing = result.findIndex(s => s.id === override.sectionId);
          if (existing < 0) {
            result.push({
              id: override.sectionId,
              title: {},
              order: result.length,
              ...override.data,
            } as Section);
          }
          break;
        }
        case 'REMOVE': {
          const rmIdx = result.findIndex(s => s.id === override.sectionId);
          if (rmIdx >= 0) {
            result.splice(rmIdx, 1);
          }
          break;
        }
        case 'REORDER': {
          const roIdx = result.findIndex(s => s.id === override.sectionId);
          if (roIdx >= 0) {
            result[roIdx] = { ...result[roIdx], order: override.data['order'] as number };
          }
          break;
        }
      }
    }

    return result.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  // ── Tenant hierarchy resolution ──

  /**
   * Given a tenantId, determine the hierarchy chain: Continental → REC → Country.
   * Uses the Tenant model to walk up the tree.
   */
  async getTenantHierarchy(tenantId: string): Promise<TenantChain> {
    const tenant = await (this.prisma as any).tenant.findUnique({
      where: { id: tenantId },
      include: { parent: { include: { parent: true } } },
    });

    if (!tenant) {
      throw new ResolverError(404, `Tenant ${tenantId} not found`);
    }

    if (tenant.level === TenantLevel.CONTINENTAL) {
      return { continental: tenantId, rec: null, country: null };
    }

    if (tenant.level === TenantLevel.REC) {
      return {
        continental: tenant.parent?.id ?? tenant.parentId,
        rec: tenantId,
        country: null,
      };
    }

    // MEMBER_STATE
    const recTenant = tenant.parent;
    const continentalTenant = recTenant?.parent ?? recTenant;

    return {
      continental: continentalTenant?.id ?? recTenant?.parentId ?? tenantId,
      rec: recTenant?.id ?? null,
      country: tenantId,
    };
  }

  // ── Helpers ──

  extractFields(schema: Record<string, unknown>): Field[] {
    // Support both section-based and flat field arrays
    const sections = schema['sections'] as Array<Record<string, unknown>> | undefined;
    if (sections && Array.isArray(sections)) {
      const allFields: Field[] = [];
      for (const section of sections) {
        const fields = section['fields'] as Field[] | undefined;
        if (fields && Array.isArray(fields)) {
          allFields.push(...fields.map(f => ({ ...f, section: section['id'] as string })));
        }
      }
      return allFields;
    }

    // Flat fields array
    const fields = schema['fields'] as Field[] | undefined;
    if (fields && Array.isArray(fields)) {
      return [...fields];
    }

    return [];
  }

  extractSections(schema: Record<string, unknown>): Section[] {
    const sections = schema['sections'] as Section[] | undefined;
    if (sections && Array.isArray(sections)) {
      return sections.map(s => {
        const { fields: _fields, ...rest } = s as Section & { fields?: unknown };
        return rest as Section;
      });
    }
    return [];
  }
}

// ── Utilities ──

export class ResolverError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = 'ResolverError';
  }
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

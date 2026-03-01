import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FormResolverService, ResolverError } from '../form-resolver.service';
import type { Field, FieldOverride } from '../form-resolver.service';
import { TenantLevel } from '@aris/shared-types';

// ── Mock Prisma ──

function mockPrisma() {
  return {
    formTemplate: {
      findUnique: vi.fn(),
    },
    formOverlay: {
      findMany: vi.fn(),
    },
    tenant: {
      findUnique: vi.fn(),
    },
  };
}

// ── Test data factories ──

function baseTemplate(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tmpl-1',
    tenant_id: 'tenant-au',
    name: 'Disease Report',
    domain: 'health',
    version: 1,
    status: 'PUBLISHED',
    schema: {
      sections: [{
        id: 'sec-1',
        title: { en: 'General' },
        order: 0,
        fields: [
          { id: 'field-A', type: 'text', label: { en: 'Country' }, order: 0, required: true },
          { id: 'field-B', type: 'text', label: { en: 'Disease' }, order: 1, required: true },
          { id: 'field-C', type: 'number', label: { en: 'Cases' }, order: 2, required: false },
          { id: 'field-D', type: 'date', label: { en: 'Date' }, order: 3, required: false },
          { id: 'field-E', type: 'select', label: { en: 'Severity' }, order: 4, required: false },
        ],
      }],
    },
    ...overrides,
  };
}

function recOverlayRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'overlay-ecowas',
    template_id: 'tmpl-1',
    template_version: 1,
    tenant_id: 'tenant-ecowas',
    tenant_level: TenantLevel.REC,
    parent_overlay_id: null,
    field_overrides: [],
    section_overrides: null,
    metadata_overrides: null,
    is_active: true,
    needs_review: false,
    created_by: 'user-ecowas',
    updated_by: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function countryOverlayRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'overlay-gh',
    template_id: 'tmpl-1',
    template_version: 1,
    tenant_id: 'tenant-gh',
    tenant_level: TenantLevel.MEMBER_STATE,
    parent_overlay_id: 'overlay-ecowas',
    field_overrides: [],
    section_overrides: null,
    metadata_overrides: null,
    is_active: true,
    needs_review: false,
    created_by: 'user-gh',
    updated_by: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function continentalTenant() {
  return {
    id: 'tenant-au',
    level: TenantLevel.CONTINENTAL,
    parentId: null,
    parent: null,
  };
}

function recTenant() {
  return {
    id: 'tenant-ecowas',
    level: TenantLevel.REC,
    parentId: 'tenant-au',
    parent: {
      id: 'tenant-au',
      level: TenantLevel.CONTINENTAL,
      parentId: null,
      parent: null,
    },
  };
}

function countryTenant(tenantId = 'tenant-gh', recId = 'tenant-ecowas') {
  return {
    id: tenantId,
    level: TenantLevel.MEMBER_STATE,
    parentId: recId,
    parent: {
      id: recId,
      level: TenantLevel.REC,
      parentId: 'tenant-au',
      parent: {
        id: 'tenant-au',
        level: TenantLevel.CONTINENTAL,
        parentId: null,
        parent: null,
      },
    },
  };
}

// ── Tests ──

describe('FormResolverService', () => {
  let service: FormResolverService;
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(() => {
    prisma = mockPrisma();
    service = new FormResolverService(prisma as never);
  });

  // ── 1. Basic merge — no overlay ──
  describe('Test 1: merge without overlays', () => {
    it('should return base fields [A,B,C,D,E] when no overlays exist', async () => {
      prisma.formTemplate.findUnique.mockResolvedValue(baseTemplate());
      prisma.tenant.findUnique.mockResolvedValue(continentalTenant());
      prisma.formOverlay.findMany.mockResolvedValue([]);

      const result = await service.resolveForm('tmpl-1', 'tenant-au');

      expect(result.resolvedFields).toHaveLength(5);
      expect(result.resolvedFields.map(f => f.id)).toEqual([
        'field-A', 'field-B', 'field-C', 'field-D', 'field-E',
      ]);
      expect(result.appliedOverlays).toHaveLength(0);
      expect(result.inheritance.level).toBe(TenantLevel.CONTINENTAL);
    });
  });

  // ── 2. REC overlay modifies field B ──
  describe('Test 2: REC overlay modifies B -> B\'', () => {
    it('should return [A, B\', C, D, E] with REC modification', async () => {
      prisma.formTemplate.findUnique.mockResolvedValue(baseTemplate());
      prisma.tenant.findUnique.mockResolvedValue(recTenant());
      prisma.formOverlay.findMany.mockResolvedValue([
        recOverlayRow({
          field_overrides: [
            { fieldId: 'field-B', action: 'MODIFY', data: { label: { en: 'Disease (ECOWAS)' } } },
          ],
        }),
      ]);

      const result = await service.resolveForm('tmpl-1', 'tenant-ecowas');

      expect(result.resolvedFields).toHaveLength(5);
      const fieldB = result.resolvedFields.find(f => f.id === 'field-B')!;
      expect((fieldB.label as any).en).toBe('Disease (ECOWAS)');
      expect(result.appliedOverlays).toHaveLength(1);
      expect(result.inheritance.level).toBe(TenantLevel.REC);
    });
  });

  // ── 3. Country overlay modifies field C ──
  describe('Test 3: Country overlay modifies C -> C\'', () => {
    it('should return [A, B, C\', D, E] with Country modification', async () => {
      prisma.formTemplate.findUnique.mockResolvedValue(baseTemplate());
      prisma.tenant.findUnique.mockResolvedValue(
        countryTenant('tenant-ke', 'tenant-eac'),
      );
      prisma.formOverlay.findMany.mockResolvedValue([
        countryOverlayRow({
          id: 'overlay-ke',
          tenant_id: 'tenant-ke',
          parent_overlay_id: null,
          field_overrides: [
            { fieldId: 'field-C', action: 'MODIFY', data: { label: { en: 'Cases (Kenya)' } } },
          ],
        }),
      ]);

      const result = await service.resolveForm('tmpl-1', 'tenant-ke');

      expect(result.resolvedFields).toHaveLength(5);
      const fieldC = result.resolvedFields.find(f => f.id === 'field-C')!;
      expect((fieldC.label as any).en).toBe('Cases (Kenya)');
    });
  });

  // ── 4. Cascade: REC override B + Country override C ──
  describe('Test 4: cascade REC B\' + Country C\'', () => {
    it('should return [A, B\', C\', D, E] with both overlays applied', async () => {
      prisma.formTemplate.findUnique.mockResolvedValue(baseTemplate());
      prisma.tenant.findUnique.mockResolvedValue(countryTenant('tenant-gh'));
      prisma.formOverlay.findMany.mockResolvedValue([
        recOverlayRow({
          field_overrides: [
            { fieldId: 'field-B', action: 'MODIFY', data: { label: { en: 'Disease (ECOWAS)' } } },
          ],
        }),
        countryOverlayRow({
          field_overrides: [
            { fieldId: 'field-C', action: 'MODIFY', data: { label: { en: 'Cases (Ghana)' } } },
          ],
        }),
      ]);

      const result = await service.resolveForm('tmpl-1', 'tenant-gh');

      expect(result.resolvedFields).toHaveLength(5);
      const fieldB = result.resolvedFields.find(f => f.id === 'field-B')!;
      const fieldC = result.resolvedFields.find(f => f.id === 'field-C')!;
      expect((fieldB.label as any).en).toBe('Disease (ECOWAS)');
      expect((fieldC.label as any).en).toBe('Cases (Ghana)');
      expect(result.appliedOverlays).toHaveLength(2);
    });
  });

  // ── 5. Country in REC with overlay: ECOWAS B', Ghana D' ──
  describe('Test 5: ECOWAS B\' + Ghana D\' → Ghana sees [A, B\', C, D\', E]', () => {
    it('should merge both REC and Country overlays', async () => {
      prisma.formTemplate.findUnique.mockResolvedValue(baseTemplate());
      prisma.tenant.findUnique.mockResolvedValue(countryTenant('tenant-gh'));
      prisma.formOverlay.findMany.mockResolvedValue([
        recOverlayRow({
          field_overrides: [
            { fieldId: 'field-B', action: 'MODIFY', data: { label: { en: 'Disease (ECOWAS)' } } },
          ],
        }),
        countryOverlayRow({
          field_overrides: [
            { fieldId: 'field-D', action: 'MODIFY', data: { label: { en: 'Date (Ghana)' } } },
          ],
        }),
      ]);

      const result = await service.resolveForm('tmpl-1', 'tenant-gh');

      expect(result.resolvedFields).toHaveLength(5);
      expect((result.resolvedFields.find(f => f.id === 'field-B')!.label as any).en).toBe('Disease (ECOWAS)');
      expect((result.resolvedFields.find(f => f.id === 'field-D')!.label as any).en).toBe('Date (Ghana)');
      // Unchanged fields
      expect((result.resolvedFields.find(f => f.id === 'field-A')!.label as any).en).toBe('Country');
      expect((result.resolvedFields.find(f => f.id === 'field-C')!.label as any).en).toBe('Cases');
    });
  });

  // ── 6. Country without overlay in REC with overlay ──
  describe('Test 6: Nigeria (ECOWAS, no overlay) → sees [A, B\', C, D, E]', () => {
    it('should apply only the REC overlay for a country without its own overlay', async () => {
      prisma.formTemplate.findUnique.mockResolvedValue(baseTemplate());
      prisma.tenant.findUnique.mockResolvedValue(countryTenant('tenant-ng'));
      prisma.formOverlay.findMany.mockResolvedValue([
        recOverlayRow({
          field_overrides: [
            { fieldId: 'field-B', action: 'MODIFY', data: { label: { en: 'Disease (ECOWAS)' } } },
          ],
        }),
        // No country overlay for Nigeria
      ]);

      const result = await service.resolveForm('tmpl-1', 'tenant-ng');

      expect(result.resolvedFields).toHaveLength(5);
      expect((result.resolvedFields.find(f => f.id === 'field-B')!.label as any).en).toBe('Disease (ECOWAS)');
      expect(result.appliedOverlays).toHaveLength(1);
      expect(result.appliedOverlays[0].tenantLevel).toBe(TenantLevel.REC);
    });
  });

  // ── 7. Country without overlay, REC without overlay ──
  describe('Test 7: Tanzania (EAC, no overlay, no REC overlay) → sees base [A,B,C,D,E]', () => {
    it('should return base template when no overlays in hierarchy', async () => {
      prisma.formTemplate.findUnique.mockResolvedValue(baseTemplate());
      prisma.tenant.findUnique.mockResolvedValue(
        countryTenant('tenant-tz', 'tenant-eac'),
      );
      prisma.formOverlay.findMany.mockResolvedValue([]);

      const result = await service.resolveForm('tmpl-1', 'tenant-tz');

      expect(result.resolvedFields).toHaveLength(5);
      expect(result.appliedOverlays).toHaveLength(0);
      expect((result.resolvedFields[0].label as any).en).toBe('Country');
    });
  });

  // ── 8. REC adds a new field F ──
  describe('Test 8: ECOWAS adds field F → Nigeria sees [A, B, C, D, E, F]', () => {
    it('should include added field from REC overlay', async () => {
      prisma.formTemplate.findUnique.mockResolvedValue(baseTemplate());
      prisma.tenant.findUnique.mockResolvedValue(countryTenant('tenant-ng'));
      prisma.formOverlay.findMany.mockResolvedValue([
        recOverlayRow({
          field_overrides: [
            { fieldId: 'field-F', action: 'ADD', data: { type: 'text', label: { en: 'Region' }, order: 5 } },
          ],
        }),
      ]);

      const result = await service.resolveForm('tmpl-1', 'tenant-ng');

      expect(result.resolvedFields).toHaveLength(6);
      const fieldF = result.resolvedFields.find(f => f.id === 'field-F')!;
      expect(fieldF).toBeDefined();
      expect((fieldF.label as any).en).toBe('Region');
    });
  });

  // ── 9. Country removes field B ──
  describe('Test 9: Kenya removes field B → Kenya sees [A, C, D, E]', () => {
    it('should hide field marked as REMOVE by country overlay', async () => {
      prisma.formTemplate.findUnique.mockResolvedValue(baseTemplate());
      prisma.tenant.findUnique.mockResolvedValue(
        countryTenant('tenant-ke', 'tenant-eac'),
      );
      prisma.formOverlay.findMany.mockResolvedValue([
        countryOverlayRow({
          id: 'overlay-ke',
          tenant_id: 'tenant-ke',
          tenant_level: TenantLevel.MEMBER_STATE,
          parent_overlay_id: null,
          field_overrides: [
            { fieldId: 'field-B', action: 'REMOVE', data: {} },
          ],
        }),
      ]);

      const result = await service.resolveForm('tmpl-1', 'tenant-ke');

      expect(result.resolvedFields).toHaveLength(4);
      expect(result.resolvedFields.find(f => f.id === 'field-B')).toBeUndefined();
    });
  });

  // ── 10. applyOverlay unit tests ──
  describe('Test 10: applyOverlay MODIFY action', () => {
    it('should modify a field in place', () => {
      const fields: Field[] = [
        { id: 'f1', type: 'text', label: { en: 'Name' }, order: 0 },
        { id: 'f2', type: 'number', label: { en: 'Age' }, order: 1 },
      ];
      const overrides: FieldOverride[] = [
        { fieldId: 'f1', action: 'MODIFY', data: { label: { en: 'Full Name' }, required: true } },
      ];

      const result = service.applyOverlay(fields, overrides);

      expect(result[0].id).toBe('f1');
      expect((result[0].label as any).en).toBe('Full Name');
      expect(result[0].required).toBe(true);
      expect(result[1].id).toBe('f2'); // unchanged
    });
  });

  // ── 11. applyOverlay REORDER action ──
  describe('Test 11: applyOverlay REORDER action', () => {
    it('should change field order', () => {
      const fields: Field[] = [
        { id: 'f1', type: 'text', label: { en: 'A' }, order: 0 },
        { id: 'f2', type: 'text', label: { en: 'B' }, order: 1 },
        { id: 'f3', type: 'text', label: { en: 'C' }, order: 2 },
      ];
      const overrides: FieldOverride[] = [
        { fieldId: 'f3', action: 'REORDER', data: { order: 0 } },
        { fieldId: 'f1', action: 'REORDER', data: { order: 2 } },
      ];

      const result = service.applyOverlay(fields, overrides);

      expect(result[0].id).toBe('f3'); // was order 2, now 0
      expect(result[1].id).toBe('f2'); // unchanged at 1
      expect(result[2].id).toBe('f1'); // was order 0, now 2
    });
  });

  // ── 12. getTenantHierarchy ──
  describe('Test 12: getTenantHierarchy', () => {
    it('should return correct chain for MEMBER_STATE tenant', async () => {
      prisma.tenant.findUnique.mockResolvedValue(countryTenant('tenant-gh'));

      const chain = await service.getTenantHierarchy('tenant-gh');

      expect(chain.continental).toBe('tenant-au');
      expect(chain.rec).toBe('tenant-ecowas');
      expect(chain.country).toBe('tenant-gh');
    });

    it('should return correct chain for REC tenant', async () => {
      prisma.tenant.findUnique.mockResolvedValue(recTenant());

      const chain = await service.getTenantHierarchy('tenant-ecowas');

      expect(chain.continental).toBe('tenant-au');
      expect(chain.rec).toBe('tenant-ecowas');
      expect(chain.country).toBeNull();
    });

    it('should return correct chain for CONTINENTAL tenant', async () => {
      prisma.tenant.findUnique.mockResolvedValue(continentalTenant());

      const chain = await service.getTenantHierarchy('tenant-au');

      expect(chain.continental).toBe('tenant-au');
      expect(chain.rec).toBeNull();
      expect(chain.country).toBeNull();
    });

    it('should throw ResolverError for unknown tenant', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      await expect(service.getTenantHierarchy('nonexistent')).rejects.toThrow(ResolverError);
    });
  });

  // ── 13. extractFields ──
  describe('Test 13: extractFields', () => {
    it('should extract fields from sections-based schema', () => {
      const schema = {
        sections: [{
          id: 'sec-1',
          fields: [
            { id: 'f1', type: 'text', label: { en: 'A' }, order: 0 },
            { id: 'f2', type: 'text', label: { en: 'B' }, order: 1 },
          ],
        }],
      };

      const fields = service.extractFields(schema);
      expect(fields).toHaveLength(2);
      expect(fields[0].section).toBe('sec-1');
    });

    it('should extract fields from flat fields array', () => {
      const schema = {
        fields: [
          { id: 'f1', type: 'text', label: { en: 'A' }, order: 0 },
        ],
      };

      const fields = service.extractFields(schema);
      expect(fields).toHaveLength(1);
    });

    it('should return empty array for empty schema', () => {
      expect(service.extractFields({})).toEqual([]);
    });
  });

  // ── 14. computeDiff ──
  describe('Test 14: computeDiff', () => {
    it('should show changes between base and resolved form', async () => {
      prisma.formTemplate.findUnique.mockResolvedValue(baseTemplate());
      prisma.tenant.findUnique.mockResolvedValue(countryTenant('tenant-gh'));
      prisma.formOverlay.findMany.mockResolvedValue([
        recOverlayRow({
          field_overrides: [
            { fieldId: 'field-B', action: 'MODIFY', data: { label: { en: 'Disease (ECOWAS)' } } },
          ],
        }),
        countryOverlayRow({
          field_overrides: [
            { fieldId: 'field-D', action: 'MODIFY', data: { label: { en: 'Date (Ghana)' } } },
          ],
        }),
      ]);

      const diff = await service.computeDiff('tmpl-1', 'tenant-gh');

      expect(diff.changes).toHaveLength(2);
      expect(diff.changes[0].fieldId).toBe('field-B');
      expect(diff.changes[0].source).toBe(TenantLevel.REC);
      expect(diff.changes[1].fieldId).toBe('field-D');
      expect(diff.changes[1].source).toBe(TenantLevel.MEMBER_STATE);
    });
  });

  // ── 15. getHierarchy ──
  describe('Test 15: getHierarchy', () => {
    it('should return tree of all overlays', async () => {
      prisma.formTemplate.findUnique.mockResolvedValue(baseTemplate());
      prisma.formOverlay.findMany.mockResolvedValue([
        recOverlayRow({
          id: 'overlay-ecowas',
          field_overrides: [
            { fieldId: 'field-B', action: 'MODIFY', data: {} },
          ],
        }),
        countryOverlayRow({
          id: 'overlay-gh',
          parent_overlay_id: 'overlay-ecowas',
          field_overrides: [
            { fieldId: 'field-D', action: 'MODIFY', data: {} },
          ],
        }),
        countryOverlayRow({
          id: 'overlay-ng',
          tenant_id: 'tenant-ng',
          parent_overlay_id: 'overlay-ecowas',
          field_overrides: [],
        }),
      ]);

      const hierarchy = await service.getHierarchy('tmpl-1');

      expect(hierarchy.templateName).toBe('Disease Report');
      expect(hierarchy.overlays).toHaveLength(1); // 1 REC node
      expect(hierarchy.overlays[0].children).toHaveLength(2); // 2 countries under ECOWAS
    });
  });

  // ── 16. Country overrides same field as REC → Country wins ──
  describe('Test 16: Country overrides same field as REC → Country wins', () => {
    it('should give priority to Country over REC for the same field', async () => {
      prisma.formTemplate.findUnique.mockResolvedValue(baseTemplate());
      prisma.tenant.findUnique.mockResolvedValue(countryTenant('tenant-gh'));
      prisma.formOverlay.findMany.mockResolvedValue([
        recOverlayRow({
          field_overrides: [
            { fieldId: 'field-B', action: 'MODIFY', data: { label: { en: 'Disease (ECOWAS)' } } },
          ],
        }),
        countryOverlayRow({
          field_overrides: [
            { fieldId: 'field-B', action: 'MODIFY', data: { label: { en: 'Disease (Ghana)' } } },
          ],
        }),
      ]);

      const result = await service.resolveForm('tmpl-1', 'tenant-gh');

      const fieldB = result.resolvedFields.find(f => f.id === 'field-B')!;
      expect((fieldB.label as any).en).toBe('Disease (Ghana)');
    });
  });

  // ── 17. Template not found ──
  describe('Test 17: template not found', () => {
    it('should throw ResolverError 404 when template does not exist', async () => {
      prisma.formTemplate.findUnique.mockResolvedValue(null);

      await expect(service.resolveForm('nonexistent', 'tenant-au')).rejects.toThrow(ResolverError);
    });
  });

  // ── 18. Multiple ADD fields from REC overlay ──
  describe('Test 18: REC adds multiple fields', () => {
    it('should add multiple new fields from REC overlay', async () => {
      prisma.formTemplate.findUnique.mockResolvedValue(baseTemplate());
      prisma.tenant.findUnique.mockResolvedValue(countryTenant('tenant-ng'));
      prisma.formOverlay.findMany.mockResolvedValue([
        recOverlayRow({
          field_overrides: [
            { fieldId: 'field-F', action: 'ADD', data: { type: 'text', label: { en: 'Region' }, order: 5 } },
            { fieldId: 'field-G', action: 'ADD', data: { type: 'number', label: { en: 'Population' }, order: 6 } },
          ],
        }),
      ]);

      const result = await service.resolveForm('tmpl-1', 'tenant-ng');

      expect(result.resolvedFields).toHaveLength(7);
      expect(result.resolvedFields.find(f => f.id === 'field-F')).toBeDefined();
      expect(result.resolvedFields.find(f => f.id === 'field-G')).toBeDefined();
    });
  });

  // ── 19. Section overlay ──
  describe('Test 19: section overlay', () => {
    it('should apply section overrides', () => {
      const baseSections = [
        { id: 'sec-1', title: { en: 'General' }, order: 0 },
        { id: 'sec-2', title: { en: 'Details' }, order: 1 },
      ];

      const result = service.applySectionOverlay(baseSections, [
        { sectionId: 'sec-1', action: 'MODIFY', data: { title: { en: 'General (Modified)' } } },
        { sectionId: 'sec-3', action: 'ADD', data: { title: { en: 'Extra Section' }, order: 2 } },
      ]);

      expect(result).toHaveLength(3);
      expect((result[0].title as any).en).toBe('General (Modified)');
      expect((result[2].title as any).en).toBe('Extra Section');
    });
  });
});

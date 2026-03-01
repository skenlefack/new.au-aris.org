import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OverlayService } from '../overlay.service';
import { TenantLevel, UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

// ── Mock factories ──

function mockPrisma() {
  return {
    formTemplate: {
      findUnique: vi.fn(),
    },
    formOverlay: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    formVersionHistory: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    tenant: {
      findUnique: vi.fn(),
    },
  };
}

function mockKafkaProducer() {
  return { send: vi.fn().mockResolvedValue([]) };
}

function continentalUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    userId: 'user-au',
    email: 'admin@au-aris.org',
    role: UserRole.SUPER_ADMIN,
    tenantId: 'tenant-au',
    tenantLevel: TenantLevel.CONTINENTAL,
    ...overrides,
  };
}

function recUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    userId: 'user-ecowas',
    email: 'admin@ecowas.au-aris.org',
    role: UserRole.REC_ADMIN,
    tenantId: 'tenant-ecowas',
    tenantLevel: TenantLevel.REC,
    ...overrides,
  };
}

function countryUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    userId: 'user-gh',
    email: 'admin@gh.au-aris.org',
    role: UserRole.NATIONAL_ADMIN,
    tenantId: 'tenant-gh',
    tenantLevel: TenantLevel.MEMBER_STATE,
    ...overrides,
  };
}

function templateFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tmpl-1',
    tenant_id: 'tenant-au',
    name: 'Disease Report',
    version: 1,
    status: 'PUBLISHED',
    schema: {
      sections: [{
        id: 'sec-1',
        fields: [
          { id: 'field-A', type: 'text', label: { en: 'Country' }, order: 0, required: true },
          { id: 'field-B', type: 'text', label: { en: 'Disease' }, order: 1, required: true },
          { id: 'field-C', type: 'number', label: { en: 'Cases' }, order: 2, required: false },
        ],
      }],
    },
    ...overrides,
  };
}

function overlayFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'overlay-1',
    template_id: 'tmpl-1',
    template_version: 1,
    tenant_id: 'tenant-ecowas',
    tenant_level: TenantLevel.REC,
    parent_overlay_id: null,
    field_overrides: [
      { fieldId: 'field-B', action: 'MODIFY', data: { label: { en: 'Disease (ECOWAS)' } } },
    ],
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

// ── Tests ──

describe('OverlayService', () => {
  let service: OverlayService;
  let prisma: ReturnType<typeof mockPrisma>;
  let kafka: ReturnType<typeof mockKafkaProducer>;

  beforeEach(() => {
    prisma = mockPrisma();
    kafka = mockKafkaProducer();
    service = new OverlayService(prisma as never, kafka as never);
  });

  // ── Test 1 (overall 20): Create overlay ──
  describe('createOverlay', () => {
    it('should create an overlay for a REC tenant', async () => {
      prisma.formTemplate.findUnique.mockResolvedValue(templateFixture());
      prisma.formOverlay.findUnique.mockResolvedValue(null); // no existing
      prisma.formOverlay.create.mockResolvedValue(overlayFixture());
      prisma.formVersionHistory.create.mockResolvedValue({});

      const result = await service.createOverlay(
        'tmpl-1',
        {
          tenantId: 'tenant-ecowas',
          tenantLevel: TenantLevel.REC,
          fieldOverrides: [
            { fieldId: 'field-B', action: 'MODIFY', data: { label: { en: 'Disease (ECOWAS)' } } },
          ],
        },
        recUser(),
      );

      expect(result.data.tenantId).toBe('tenant-ecowas');
      expect(result.data.tenantLevel).toBe(TenantLevel.REC);
      expect(result.data.fieldOverrides).toHaveLength(1);
      expect(kafka.send).toHaveBeenCalled();
    });

    it('should throw 409 if overlay already exists for tenant+template', async () => {
      prisma.formTemplate.findUnique.mockResolvedValue(templateFixture());
      prisma.formOverlay.findUnique.mockResolvedValue(overlayFixture());

      await expect(
        service.createOverlay(
          'tmpl-1',
          {
            tenantId: 'tenant-ecowas',
            tenantLevel: TenantLevel.REC,
            fieldOverrides: [
              { fieldId: 'field-B', action: 'MODIFY', data: {} },
            ],
          },
          recUser(),
        ),
      ).rejects.toThrow(/already exists/);
    });

    it('should throw 404 if template does not exist', async () => {
      prisma.formTemplate.findUnique.mockResolvedValue(null);

      await expect(
        service.createOverlay(
          'nonexistent',
          {
            tenantId: 'tenant-ecowas',
            tenantLevel: TenantLevel.REC,
            fieldOverrides: [{ fieldId: 'f1', action: 'MODIFY', data: {} }],
          },
          recUser(),
        ),
      ).rejects.toThrow(/not found/);
    });

    it('should throw 400 for invalid tenant level', async () => {
      prisma.formTemplate.findUnique.mockResolvedValue(templateFixture());

      await expect(
        service.createOverlay(
          'tmpl-1',
          {
            tenantId: 'tenant-au',
            tenantLevel: TenantLevel.CONTINENTAL,
            fieldOverrides: [{ fieldId: 'f1', action: 'MODIFY', data: {} }],
          },
          continentalUser(),
        ),
      ).rejects.toThrow(/REC or MEMBER_STATE/);
    });
  });

  // ── Test 2 (overall 21): RBAC — REC admin cannot create overlay for another REC ──
  describe('RBAC', () => {
    it('should deny REC admin creating overlay for another REC', async () => {
      prisma.formTemplate.findUnique.mockResolvedValue(templateFixture());

      await expect(
        service.createOverlay(
          'tmpl-1',
          {
            tenantId: 'tenant-sadc',
            tenantLevel: TenantLevel.REC,
            fieldOverrides: [{ fieldId: 'field-B', action: 'MODIFY', data: {} }],
          },
          recUser(), // ECOWAS admin trying to create for SADC
        ),
      ).rejects.toThrow(/REC admin can only manage/);
    });

    it('should deny COUNTRY admin modifying the template base', async () => {
      // Country admin cannot create overlay for REC level
      prisma.formTemplate.findUnique.mockResolvedValue(templateFixture());

      await expect(
        service.createOverlay(
          'tmpl-1',
          {
            tenantId: 'tenant-ecowas',
            tenantLevel: TenantLevel.REC,
            fieldOverrides: [{ fieldId: 'field-B', action: 'MODIFY', data: {} }],
          },
          countryUser(), // Country admin, not REC
        ),
      ).rejects.toThrow(/National admin can only manage/);
    });

    it('should deny COUNTRY admin creating overlay for another country', async () => {
      prisma.formTemplate.findUnique.mockResolvedValue(templateFixture());

      await expect(
        service.createOverlay(
          'tmpl-1',
          {
            tenantId: 'tenant-ng',
            tenantLevel: TenantLevel.MEMBER_STATE,
            fieldOverrides: [{ fieldId: 'field-B', action: 'MODIFY', data: {} }],
          },
          countryUser(), // Ghana admin trying for Nigeria
        ),
      ).rejects.toThrow(/National admin can only manage/);
    });

    it('should allow CONTINENTAL admin to create overlay for any tenant', async () => {
      prisma.formTemplate.findUnique.mockResolvedValue(templateFixture());
      prisma.formOverlay.findUnique.mockResolvedValue(null);
      prisma.formOverlay.create.mockResolvedValue(overlayFixture());
      prisma.formVersionHistory.create.mockResolvedValue({});

      const result = await service.createOverlay(
        'tmpl-1',
        {
          tenantId: 'tenant-ecowas',
          tenantLevel: TenantLevel.REC,
          fieldOverrides: [{ fieldId: 'field-B', action: 'MODIFY', data: {} }],
        },
        continentalUser(),
      );

      expect(result.data).toBeDefined();
    });
  });

  // ── Test 3 (overall 22): Update overlay ──
  describe('updateOverlay', () => {
    it('should update an existing overlay', async () => {
      prisma.formOverlay.findUnique.mockResolvedValue(overlayFixture());
      prisma.formTemplate.findUnique.mockResolvedValue(templateFixture());
      const updatedOverlay = overlayFixture({
        field_overrides: [
          { fieldId: 'field-B', action: 'MODIFY', data: { label: { en: 'Disease (Updated)' } } },
        ],
      });
      prisma.formOverlay.update.mockResolvedValue(updatedOverlay);
      prisma.formVersionHistory.create.mockResolvedValue({});

      const result = await service.updateOverlay(
        'tmpl-1',
        'overlay-1',
        {
          fieldOverrides: [
            { fieldId: 'field-B', action: 'MODIFY', data: { label: { en: 'Disease (Updated)' } } },
          ],
        },
        recUser(),
      );

      expect(result.data.fieldOverrides[0].data).toEqual({ label: { en: 'Disease (Updated)' } });
      expect(prisma.formOverlay.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'overlay-1' },
          data: expect.objectContaining({ needs_review: false }),
        }),
      );
    });
  });

  // ── Test 4 (overall 23): Delete overlay ──
  describe('deleteOverlay', () => {
    it('should delete an overlay and record history', async () => {
      prisma.formOverlay.findUnique.mockResolvedValue(overlayFixture());
      prisma.formOverlay.delete.mockResolvedValue(overlayFixture());
      prisma.formVersionHistory.create.mockResolvedValue({});

      await service.deleteOverlay('tmpl-1', 'overlay-1', recUser());

      expect(prisma.formOverlay.delete).toHaveBeenCalledWith({ where: { id: 'overlay-1' } });
      expect(prisma.formVersionHistory.create).toHaveBeenCalled();
    });

    it('should throw 404 for nonexistent overlay', async () => {
      prisma.formOverlay.findUnique.mockResolvedValue(null);

      await expect(
        service.deleteOverlay('tmpl-1', 'nonexistent', recUser()),
      ).rejects.toThrow(/not found/);
    });
  });

  // ── Test 5 (overall 24): History recording ──
  describe('history', () => {
    it('should record history when overlay is created', async () => {
      prisma.formTemplate.findUnique.mockResolvedValue(templateFixture());
      prisma.formOverlay.findUnique.mockResolvedValue(null);
      prisma.formOverlay.create.mockResolvedValue(overlayFixture());
      prisma.formVersionHistory.create.mockResolvedValue({});

      await service.createOverlay(
        'tmpl-1',
        {
          tenantId: 'tenant-ecowas',
          tenantLevel: TenantLevel.REC,
          fieldOverrides: [{ fieldId: 'field-B', action: 'MODIFY', data: {} }],
        },
        recUser(),
      );

      expect(prisma.formVersionHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            change_type: 'OVERLAY_CREATED',
            template_id: 'tmpl-1',
          }),
        }),
      );
    });

    it('should return paginated history entries', async () => {
      prisma.formVersionHistory.findMany.mockResolvedValue([
        {
          id: 'hist-1',
          template_id: 'tmpl-1',
          overlay_id: null,
          version: 1,
          change_type: 'BASE_UPDATED',
          change_delta: {},
          changed_by: 'user-au',
          tenant_id: 'tenant-au',
          created_at: new Date(),
        },
      ]);
      prisma.formVersionHistory.count.mockResolvedValue(1);

      const result = await service.getHistory('tmpl-1', { page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].changeType).toBe('BASE_UPDATED');
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20 });
    });
  });

  // ── Test 6 (overall 25): Propagation ──
  describe('propagateBaseUpdate', () => {
    it('should flag conflicting overlays when base field is modified', async () => {
      prisma.formOverlay.findMany.mockResolvedValue([
        overlayFixture({
          id: 'overlay-ecowas',
          tenant_id: 'tenant-ecowas',
          field_overrides: [
            { fieldId: 'field-B', action: 'MODIFY', data: {} },
          ],
        }),
        overlayFixture({
          id: 'overlay-sadc',
          tenant_id: 'tenant-sadc',
          field_overrides: [
            { fieldId: 'field-C', action: 'MODIFY', data: {} },
          ],
        }),
      ]);
      prisma.formOverlay.update.mockResolvedValue({});
      prisma.formVersionHistory.create.mockResolvedValue({});

      const result = await service.propagateBaseUpdate(
        'tmpl-1',
        ['field-B'], // modifying field-B
        continentalUser(),
      );

      expect(result.totalOverlays).toBe(2);
      expect(result.conflicting).toHaveLength(1);
      expect(result.conflicting[0].overlayId).toBe('overlay-ecowas');
      expect(result.conflicting[0].conflictingFields).toEqual(['field-B']);
      expect(result.unaffected).toBe(1);

      // Should have updated the conflicting overlay's needs_review flag
      expect(prisma.formOverlay.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'overlay-ecowas' },
          data: { needs_review: true },
        }),
      );
    });

    it('should report no conflicts when modified fields have no overlays', async () => {
      prisma.formOverlay.findMany.mockResolvedValue([
        overlayFixture({
          field_overrides: [
            { fieldId: 'field-B', action: 'MODIFY', data: {} },
          ],
        }),
      ]);
      prisma.formVersionHistory.create.mockResolvedValue({});

      const result = await service.propagateBaseUpdate(
        'tmpl-1',
        ['field-A'], // modifying field-A which no overlay touches
        continentalUser(),
      );

      expect(result.conflicting).toHaveLength(0);
      expect(result.unaffected).toBe(1);
    });
  });

  // ── Test 7 (overall 26): Validate field overrides ──
  describe('field override validation', () => {
    it('should reject MODIFY override for nonexistent field', async () => {
      prisma.formTemplate.findUnique.mockResolvedValue(templateFixture());
      prisma.formOverlay.findUnique.mockResolvedValue(null);

      await expect(
        service.createOverlay(
          'tmpl-1',
          {
            tenantId: 'tenant-ecowas',
            tenantLevel: TenantLevel.REC,
            fieldOverrides: [
              { fieldId: 'nonexistent-field', action: 'MODIFY', data: {} },
            ],
          },
          recUser(),
        ),
      ).rejects.toThrow(/not found in template/);
    });

    it('should allow ADD override for new field ID', async () => {
      prisma.formTemplate.findUnique.mockResolvedValue(templateFixture());
      prisma.formOverlay.findUnique.mockResolvedValue(null);
      prisma.formOverlay.create.mockResolvedValue(
        overlayFixture({
          field_overrides: [
            { fieldId: 'new-field', action: 'ADD', data: { type: 'text', label: { en: 'New' }, order: 10 } },
          ],
        }),
      );
      prisma.formVersionHistory.create.mockResolvedValue({});

      const result = await service.createOverlay(
        'tmpl-1',
        {
          tenantId: 'tenant-ecowas',
          tenantLevel: TenantLevel.REC,
          fieldOverrides: [
            { fieldId: 'new-field', action: 'ADD', data: { type: 'text', label: { en: 'New' }, order: 10 } },
          ],
        },
        recUser(),
      );

      expect(result.data).toBeDefined();
    });
  });

  // ── Test 8 (overall 27): Concurrent overlay creation (unique constraint) ──
  describe('concurrency', () => {
    it('should prevent duplicate overlays via unique constraint check', async () => {
      prisma.formTemplate.findUnique.mockResolvedValue(templateFixture());
      // First call: no existing, second call: already exists
      prisma.formOverlay.findUnique
        .mockResolvedValueOnce(null) // first attempt succeeds
        .mockResolvedValueOnce(overlayFixture()); // second attempt finds existing

      prisma.formOverlay.create.mockResolvedValue(overlayFixture());
      prisma.formVersionHistory.create.mockResolvedValue({});

      // First creation succeeds
      await service.createOverlay(
        'tmpl-1',
        {
          tenantId: 'tenant-ecowas',
          tenantLevel: TenantLevel.REC,
          fieldOverrides: [{ fieldId: 'field-B', action: 'MODIFY', data: {} }],
        },
        recUser(),
      );

      // Second creation should be rejected
      await expect(
        service.createOverlay(
          'tmpl-1',
          {
            tenantId: 'tenant-ecowas',
            tenantLevel: TenantLevel.REC,
            fieldOverrides: [{ fieldId: 'field-C', action: 'MODIFY', data: {} }],
          },
          recUser(),
        ),
      ).rejects.toThrow(/already exists/);
    });
  });

  // ── Test 9 (overall 28): Kafka event publishing ──
  describe('kafka events', () => {
    it('should publish overlay created event to Kafka', async () => {
      prisma.formTemplate.findUnique.mockResolvedValue(templateFixture());
      prisma.formOverlay.findUnique.mockResolvedValue(null);
      prisma.formOverlay.create.mockResolvedValue(overlayFixture());
      prisma.formVersionHistory.create.mockResolvedValue({});

      await service.createOverlay(
        'tmpl-1',
        {
          tenantId: 'tenant-ecowas',
          tenantLevel: TenantLevel.REC,
          fieldOverrides: [{ fieldId: 'field-B', action: 'MODIFY', data: {} }],
        },
        recUser(),
      );

      expect(kafka.send).toHaveBeenCalledWith(
        'ms.formbuilder.overlay.created.v1',
        'overlay-1',
        expect.objectContaining({ tenant_id: 'tenant-ecowas' }),
        expect.objectContaining({ sourceService: 'form-builder-service' }),
      );
    });

    it('should not fail if Kafka publish fails', async () => {
      prisma.formTemplate.findUnique.mockResolvedValue(templateFixture());
      prisma.formOverlay.findUnique.mockResolvedValue(null);
      prisma.formOverlay.create.mockResolvedValue(overlayFixture());
      prisma.formVersionHistory.create.mockResolvedValue({});
      kafka.send.mockRejectedValue(new Error('Kafka down'));

      const result = await service.createOverlay(
        'tmpl-1',
        {
          tenantId: 'tenant-ecowas',
          tenantLevel: TenantLevel.REC,
          fieldOverrides: [{ fieldId: 'field-B', action: 'MODIFY', data: {} }],
        },
        recUser(),
      );

      expect(result.data).toBeDefined();
    });
  });
});

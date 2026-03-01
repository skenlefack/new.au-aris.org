import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TemplateService, HttpError } from '../../services/template.service';
import { TenantLevel, UserRole, DataClassification } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

// ── Mock factories ──

function mockPrismaService() {
  return {
    formTemplate: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
  };
}

function mockKafkaProducer() {
  return {
    send: vi.fn().mockResolvedValue([]),
  };
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
    userId: 'user-igad',
    email: 'coord@igad.au-aris.org',
    role: UserRole.REC_ADMIN,
    tenantId: 'tenant-igad',
    tenantLevel: TenantLevel.REC,
    ...overrides,
  };
}

function msUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    userId: 'user-ke',
    email: 'admin@ke.au-aris.org',
    role: UserRole.NATIONAL_ADMIN,
    tenantId: 'tenant-ke',
    tenantLevel: TenantLevel.MEMBER_STATE,
    ...overrides,
  };
}

function templateFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tmpl-1',
    tenant_id: 'tenant-au',
    name: 'Animal Disease Event Report',
    domain: 'health',
    version: 1,
    parent_template_id: null,
    schema: {
      type: 'object',
      required: ['country', 'disease'],
      properties: {
        country: { type: 'string', title: 'Country' },
        disease: { type: 'string', title: 'Disease' },
      },
    },
    ui_schema: {
      'ui:order': ['country', 'disease'],
    },
    data_contract_id: null,
    status: 'DRAFT',
    data_classification: 'RESTRICTED',
    created_by: 'user-au',
    updated_by: null,
    published_at: null,
    archived_at: null,
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
    ...overrides,
  };
}

// ── Tests ──

describe('TemplateService', () => {
  let service: TemplateService;
  let prisma: ReturnType<typeof mockPrismaService>;
  let kafka: ReturnType<typeof mockKafkaProducer>;

  beforeEach(() => {
    prisma = mockPrismaService();
    kafka = mockKafkaProducer();
    service = new TemplateService(prisma as never, kafka as never);
  });

  // ── create ──

  describe('create', () => {
    it('should create a template and publish Kafka event', async () => {
      const dto = {
        name: 'Animal Disease Event Report',
        domain: 'health',
        schema: { type: 'object', properties: {} },
      };

      prisma.formTemplate.findFirst.mockResolvedValue(null);
      prisma.formTemplate.create.mockResolvedValue(templateFixture());

      const result = await service.create(dto, continentalUser());

      expect(result.data.name).toBe('Animal Disease Event Report');
      expect(result.data.version).toBe(1);
      expect(result.data.status).toBe('DRAFT');
      expect(prisma.formTemplate.create).toHaveBeenCalledOnce();
      expect(kafka.send).toHaveBeenCalledWith(
        'ms.formbuilder.template.created.v1',
        'tmpl-1',
        expect.objectContaining({ name: 'Animal Disease Event Report' }),
        expect.objectContaining({ sourceService: 'form-builder-service' }),
      );
    });

    it('should throw HttpError 409 if duplicate name+version exists', async () => {
      prisma.formTemplate.findFirst.mockResolvedValue(templateFixture());

      await expect(
        service.create(
          { name: 'Animal Disease Event Report', domain: 'health', schema: {} },
          continentalUser(),
        ),
      ).rejects.toThrow(HttpError);

      try {
        await service.create(
          { name: 'Animal Disease Event Report', domain: 'health', schema: {} },
          continentalUser(),
        );
      } catch (e) {
        expect((e as HttpError).statusCode).toBe(409);
      }
    });

    it('should throw HttpError 404 if parentTemplateId does not exist', async () => {
      prisma.formTemplate.findUnique.mockResolvedValue(null);

      await expect(
        service.create(
          {
            name: 'Child Template',
            domain: 'health',
            schema: {},
            parentTemplateId: 'nonexistent',
          },
          continentalUser(),
        ),
      ).rejects.toThrow(HttpError);
    });

    it('should not fail request if Kafka publish errors', async () => {
      prisma.formTemplate.findFirst.mockResolvedValue(null);
      prisma.formTemplate.create.mockResolvedValue(templateFixture());
      kafka.send.mockRejectedValue(new Error('Kafka down'));

      const result = await service.create(
        { name: 'Test', domain: 'health', schema: {} },
        continentalUser(),
      );

      expect(result.data).toBeDefined();
    });

    it('should set default data classification to RESTRICTED', async () => {
      prisma.formTemplate.findFirst.mockResolvedValue(null);
      prisma.formTemplate.create.mockResolvedValue(templateFixture());

      await service.create(
        { name: 'Test', domain: 'health', schema: {} },
        continentalUser(),
      );

      expect(prisma.formTemplate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            data_classification: DataClassification.RESTRICTED,
          }),
        }),
      );
    });
  });

  // ── findAll ──

  describe('findAll', () => {
    it('should return all templates for CONTINENTAL user', async () => {
      prisma.formTemplate.findMany.mockResolvedValue([templateFixture()]);
      prisma.formTemplate.count.mockResolvedValue(1);

      const result = await service.findAll(continentalUser(), {});

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20 });
    });

    it('should filter by domain and status', async () => {
      prisma.formTemplate.findMany.mockResolvedValue([]);
      prisma.formTemplate.count.mockResolvedValue(0);

      await service.findAll(continentalUser(), {
        domain: 'health',
        status: 'PUBLISHED',
      });

      expect(prisma.formTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            domain: 'health',
            status: 'PUBLISHED',
          }),
        }),
      );
    });

    it('should cap limit at MAX_LIMIT (100)', async () => {
      prisma.formTemplate.findMany.mockResolvedValue([]);
      prisma.formTemplate.count.mockResolvedValue(0);

      const result = await service.findAll(continentalUser(), { limit: 500 });

      expect(result.meta.limit).toBe(100);
    });

    it('should respect pagination parameters', async () => {
      prisma.formTemplate.findMany.mockResolvedValue([]);
      prisma.formTemplate.count.mockResolvedValue(50);

      const result = await service.findAll(continentalUser(), {
        page: 3,
        limit: 10,
        sort: 'name',
        order: 'desc',
      });

      expect(result.meta).toEqual({ total: 50, page: 3, limit: 10 });
      expect(prisma.formTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
          orderBy: { name: 'desc' },
        }),
      );
    });
  });

  // ── findOne ──

  describe('findOne', () => {
    it('should return a template by ID with resolved inheritance', async () => {
      prisma.formTemplate.findUnique.mockResolvedValue(templateFixture());

      const result = await service.findOne('tmpl-1', continentalUser());

      expect(result.data.name).toBe('Animal Disease Event Report');
    });

    it('should throw HttpError 404 for nonexistent template', async () => {
      prisma.formTemplate.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne('nonexistent', continentalUser()),
      ).rejects.toThrow(HttpError);
    });

    it('should deny access to other tenant templates for MS user', async () => {
      prisma.formTemplate.findUnique.mockResolvedValue(
        templateFixture({ tenant_id: 'tenant-ng' }),
      );

      await expect(
        service.findOne('tmpl-1', msUser()),
      ).rejects.toThrow(HttpError);
    });
  });

  // ── update ──

  describe('update', () => {
    it('should update a DRAFT template in place', async () => {
      const updated = templateFixture({ name: 'Updated Report' });
      prisma.formTemplate.findUnique.mockResolvedValue(templateFixture());
      prisma.formTemplate.update.mockResolvedValue(updated);

      const result = await service.update(
        'tmpl-1',
        { name: 'Updated Report' },
        continentalUser(),
      );

      expect(result.data.name).toBe('Updated Report');
      expect(prisma.formTemplate.update).toHaveBeenCalledOnce();
    });

    it('should throw HttpError 404 when updating nonexistent template', async () => {
      prisma.formTemplate.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { name: 'X' }, continentalUser()),
      ).rejects.toThrow(HttpError);
    });

    it('should throw HttpError 400 when updating an archived template', async () => {
      prisma.formTemplate.findUnique.mockResolvedValue(
        templateFixture({ status: 'ARCHIVED' }),
      );

      await expect(
        service.update('tmpl-1', { name: 'X' }, continentalUser()),
      ).rejects.toThrow(HttpError);
    });
  });

  // ── Version Management ──

  describe('version management', () => {
    it('should create a new version when updating a PUBLISHED template', async () => {
      const published = templateFixture({
        status: 'PUBLISHED',
        published_at: new Date(),
      });
      prisma.formTemplate.findUnique.mockResolvedValue(published);

      prisma.formTemplate.findFirst.mockResolvedValue(
        templateFixture({ version: 1 }),
      );

      const newVersion = templateFixture({
        id: 'tmpl-2',
        version: 2,
        status: 'DRAFT',
      });
      prisma.formTemplate.create.mockResolvedValue(newVersion);

      const result = await service.update(
        'tmpl-1',
        { name: 'Updated Report' },
        continentalUser(),
      );

      expect(result.data.version).toBe(2);
      expect(result.data.status).toBe('DRAFT');
      expect(prisma.formTemplate.create).toHaveBeenCalledOnce();
      expect(prisma.formTemplate.update).not.toHaveBeenCalled();
    });

    it('should increment to version 3 when versions 1 and 2 already exist', async () => {
      const published = templateFixture({
        status: 'PUBLISHED',
        published_at: new Date(),
      });
      prisma.formTemplate.findUnique.mockResolvedValue(published);

      prisma.formTemplate.findFirst.mockResolvedValue(
        templateFixture({ version: 2 }),
      );

      const newVersion = templateFixture({
        id: 'tmpl-3',
        version: 3,
        status: 'DRAFT',
      });
      prisma.formTemplate.create.mockResolvedValue(newVersion);

      const result = await service.update(
        'tmpl-1',
        { schema: { type: 'object' } },
        continentalUser(),
      );

      expect(result.data.version).toBe(3);
    });

    it('should carry forward parent_template_id to new version', async () => {
      const published = templateFixture({
        status: 'PUBLISHED',
        parent_template_id: 'tmpl-parent',
      });
      prisma.formTemplate.findUnique.mockResolvedValue(published);
      prisma.formTemplate.findFirst.mockResolvedValue(
        templateFixture({ version: 1 }),
      );
      prisma.formTemplate.create.mockResolvedValue(
        templateFixture({ id: 'tmpl-new', version: 2 }),
      );

      await service.update('tmpl-1', { name: 'V2' }, continentalUser());

      expect(prisma.formTemplate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            parent_template_id: 'tmpl-parent',
          }),
        }),
      );
    });
  });

  // ── publish ──

  describe('publish', () => {
    it('should publish a DRAFT template', async () => {
      const draft = templateFixture();
      prisma.formTemplate.findUnique.mockResolvedValue(draft);
      prisma.formTemplate.update.mockResolvedValue(
        templateFixture({ status: 'PUBLISHED', published_at: new Date() }),
      );

      const result = await service.publish('tmpl-1', continentalUser());

      expect(result.data.status).toBe('PUBLISHED');
      expect(kafka.send).toHaveBeenCalledWith(
        'ms.formbuilder.template.published.v1',
        'tmpl-1',
        expect.anything(),
        expect.objectContaining({ sourceService: 'form-builder-service' }),
      );
    });

    it('should throw HttpError 400 when publishing a non-DRAFT template', async () => {
      prisma.formTemplate.findUnique.mockResolvedValue(
        templateFixture({ status: 'PUBLISHED' }),
      );

      await expect(
        service.publish('tmpl-1', continentalUser()),
      ).rejects.toThrow(HttpError);
    });

    it('should throw HttpError 404 for nonexistent template', async () => {
      prisma.formTemplate.findUnique.mockResolvedValue(null);

      await expect(
        service.publish('nonexistent', continentalUser()),
      ).rejects.toThrow(HttpError);
    });
  });

  // ── archive ──

  describe('archive', () => {
    it('should archive a template', async () => {
      prisma.formTemplate.findUnique.mockResolvedValue(templateFixture());
      prisma.formTemplate.update.mockResolvedValue(
        templateFixture({ status: 'ARCHIVED', archived_at: new Date() }),
      );

      const result = await service.archive('tmpl-1', continentalUser());

      expect(result.data.status).toBe('ARCHIVED');
    });

    it('should throw HttpError 400 when archiving already archived template', async () => {
      prisma.formTemplate.findUnique.mockResolvedValue(
        templateFixture({ status: 'ARCHIVED' }),
      );

      await expect(
        service.archive('tmpl-1', continentalUser()),
      ).rejects.toThrow(HttpError);
    });
  });

  // ── Inheritance Resolution ──

  describe('inheritance resolution', () => {
    it('should return template as-is when no parent', async () => {
      const tmpl = templateFixture();

      const resolved = await service.resolveInheritance(tmpl);

      expect(resolved.schema).toEqual(tmpl.schema);
      expect(resolved.uiSchema).toEqual(tmpl.ui_schema);
    });

    it('should merge parent schema properties into child', async () => {
      const parentTmpl = templateFixture({
        id: 'tmpl-parent',
        schema: {
          type: 'object',
          required: ['country', 'disease'],
          properties: {
            country: { type: 'string', title: 'Country' },
            disease: { type: 'string', title: 'Disease' },
          },
        },
        ui_schema: {
          'ui:order': ['country', 'disease'],
        },
      });

      const childTmpl = templateFixture({
        id: 'tmpl-child',
        parent_template_id: 'tmpl-parent',
        schema: {
          type: 'object',
          required: ['species'],
          properties: {
            species: { type: 'string', title: 'Species' },
          },
        },
        ui_schema: {
          'ui:order': ['country', 'disease', 'species'],
        },
      });

      prisma.formTemplate.findUnique.mockResolvedValueOnce(parentTmpl);

      const resolved = await service.resolveInheritance(childTmpl);

      const schema = resolved.schema as Record<string, unknown>;
      const properties = schema['properties'] as Record<string, unknown>;
      expect(properties).toHaveProperty('country');
      expect(properties).toHaveProperty('disease');
      expect(properties).toHaveProperty('species');

      const required = schema['required'] as string[];
      expect(required).toContain('country');
      expect(required).toContain('disease');
      expect(required).toContain('species');
    });

    it('should support 3-level inheritance chain (AU -> REC -> MS)', async () => {
      const auTmpl = templateFixture({
        id: 'tmpl-au',
        parent_template_id: null,
        schema: {
          type: 'object',
          required: ['country'],
          properties: {
            country: { type: 'string', title: 'Country' },
          },
        },
        ui_schema: {},
      });

      const recTmpl = templateFixture({
        id: 'tmpl-rec',
        parent_template_id: 'tmpl-au',
        schema: {
          type: 'object',
          required: ['region'],
          properties: {
            region: { type: 'string', title: 'REC Region' },
          },
        },
        ui_schema: {},
      });

      const msTmpl = templateFixture({
        id: 'tmpl-ms',
        parent_template_id: 'tmpl-rec',
        schema: {
          type: 'object',
          required: ['local_id'],
          properties: {
            local_id: { type: 'string', title: 'National Case ID' },
          },
        },
        ui_schema: {},
      });

      prisma.formTemplate.findUnique
        .mockResolvedValueOnce(recTmpl)
        .mockResolvedValueOnce(auTmpl);

      const resolved = await service.resolveInheritance(msTmpl);

      const schema = resolved.schema as Record<string, unknown>;
      const properties = schema['properties'] as Record<string, unknown>;
      expect(properties).toHaveProperty('country');
      expect(properties).toHaveProperty('region');
      expect(properties).toHaveProperty('local_id');

      const required = schema['required'] as string[];
      expect(required).toContain('country');
      expect(required).toContain('region');
      expect(required).toContain('local_id');
    });

    it('child property should override parent property with same key', async () => {
      const parentTmpl = templateFixture({
        id: 'tmpl-parent',
        schema: {
          type: 'object',
          properties: {
            cases: { type: 'integer', title: 'Cases', minimum: 0 },
          },
        },
        ui_schema: {},
      });

      const childTmpl = templateFixture({
        id: 'tmpl-child',
        parent_template_id: 'tmpl-parent',
        schema: {
          type: 'object',
          properties: {
            cases: { type: 'integer', title: 'Confirmed Cases', minimum: 1 },
          },
        },
        ui_schema: {},
      });

      prisma.formTemplate.findUnique.mockResolvedValueOnce(parentTmpl);

      const resolved = await service.resolveInheritance(childTmpl);

      const schema = resolved.schema as Record<string, unknown>;
      const properties = schema['properties'] as Record<string, unknown>;
      const cases = properties['cases'] as Record<string, unknown>;
      expect(cases['title']).toBe('Confirmed Cases');
      expect(cases['minimum']).toBe(1);
    });

    it('should deduplicate required fields from parent and child', async () => {
      const parentTmpl = templateFixture({
        id: 'tmpl-parent',
        schema: {
          type: 'object',
          required: ['country', 'disease'],
        },
        ui_schema: {},
      });

      const childTmpl = templateFixture({
        id: 'tmpl-child',
        parent_template_id: 'tmpl-parent',
        schema: {
          type: 'object',
          required: ['disease', 'species'],
        },
        ui_schema: {},
      });

      prisma.formTemplate.findUnique.mockResolvedValueOnce(parentTmpl);

      const resolved = await service.resolveInheritance(childTmpl);

      const schema = resolved.schema as Record<string, unknown>;
      const required = schema['required'] as string[];
      expect(required).toEqual(['country', 'disease', 'species']);
    });

    it('should detect circular inheritance and throw', async () => {
      const tmplA = templateFixture({
        id: 'tmpl-a',
        parent_template_id: 'tmpl-b',
        schema: { type: 'object' },
        ui_schema: {},
      });

      const tmplB = templateFixture({
        id: 'tmpl-b',
        parent_template_id: 'tmpl-a',
        schema: { type: 'object' },
        ui_schema: {},
      });

      prisma.formTemplate.findUnique
        .mockResolvedValueOnce(tmplB)
        .mockResolvedValueOnce(tmplA);

      await expect(service.resolveInheritance(tmplA)).rejects.toThrow(
        HttpError,
      );
    });
  });

  // ── deepMergeSchema ──

  describe('deepMergeSchema', () => {
    it('should deep merge two plain objects', () => {
      const parent = { a: 1, b: 2 };
      const child = { b: 3, c: 4 };

      const result = service.deepMergeSchema(parent, child);

      expect(result).toEqual({ a: 1, b: 3, c: 4 });
    });

    it('should merge nested properties objects', () => {
      const parent = {
        properties: {
          country: { type: 'string' },
          disease: { type: 'string' },
        },
      };
      const child = {
        properties: {
          species: { type: 'string' },
        },
      };

      const result = service.deepMergeSchema(parent, child);

      expect(result['properties']).toEqual({
        country: { type: 'string' },
        disease: { type: 'string' },
        species: { type: 'string' },
      });
    });

    it('should merge and deduplicate required arrays', () => {
      const parent = { required: ['a', 'b'] };
      const child = { required: ['b', 'c'] };

      const result = service.deepMergeSchema(parent, child);

      expect(result['required']).toEqual(['a', 'b', 'c']);
    });

    it('should handle empty parent', () => {
      const result = service.deepMergeSchema({}, { type: 'object' });
      expect(result).toEqual({ type: 'object' });
    });

    it('should handle empty child', () => {
      const result = service.deepMergeSchema({ type: 'object' }, {});
      expect(result).toEqual({ type: 'object' });
    });
  });

  // ── Tenant access ──

  describe('tenant access', () => {
    it('should allow CONTINENTAL user to access any tenant template', async () => {
      prisma.formTemplate.findUnique.mockResolvedValue(
        templateFixture({ tenant_id: 'tenant-ng' }),
      );

      const result = await service.findOne('tmpl-1', continentalUser());
      expect(result.data).toBeDefined();
    });

    it('should allow user to access own tenant template', async () => {
      prisma.formTemplate.findUnique.mockResolvedValue(
        templateFixture({ tenant_id: 'tenant-ke' }),
      );

      const result = await service.findOne('tmpl-1', msUser());
      expect(result.data).toBeDefined();
    });

    it('should deny MS user access to another MS tenant template', async () => {
      prisma.formTemplate.findUnique.mockResolvedValue(
        templateFixture({ tenant_id: 'tenant-ng' }),
      );

      await expect(
        service.findOne('tmpl-1', msUser()),
      ).rejects.toThrow(HttpError);
    });
  });
});

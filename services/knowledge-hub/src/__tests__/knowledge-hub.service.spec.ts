import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PublicationService } from '../services/publication.service';
import { ELearningService } from '../services/elearning.service';
import { FaqService } from '../services/faq.service';

// ── Constants ──

const TENANT_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_TENANT_ID = '33333333-3333-3333-3333-333333333333';
const USER_ID = '22222222-2222-2222-2222-222222222222';

// ── Mock Factories ──

function createMockUser(overrides = {}) {
  return {
    userId: USER_ID,
    tenantId: TENANT_ID,
    tenantLevel: 'CONTINENTAL' as const,
    role: 'SUPER_ADMIN' as const,
    email: 'admin@au-aris.org',
    firstName: 'Super',
    lastName: 'Admin',
    ...overrides,
  };
}

function createMockPrisma() {
  return {
    publication: {
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
      update: vi.fn(),
    },
    eLearningModule: {
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
      update: vi.fn(),
    },
    learnerProgress: {
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn(),
    },
    fAQ: {
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
      update: vi.fn(),
    },
  };
}

function createMockKafka() {
  return {
    send: vi.fn().mockResolvedValue(undefined),
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
  };
}

// ── PublicationService ──

describe('PublicationService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let kafka: ReturnType<typeof createMockKafka>;
  let service: PublicationService;

  beforeEach(() => {
    prisma = createMockPrisma();
    kafka = createMockKafka();
    service = new PublicationService(prisma as never, kafka as never);
  });

  // Test 1: create -- creates publication and publishes Kafka event
  it('create -- creates publication and publishes Kafka event', async () => {
    const input = {
      title: 'Test Publication',
      authors: ['Author 1'],
      domain: 'ANIMAL_HEALTH',
      type: 'BRIEF' as const,
    };

    const created = {
      id: 'pub-1',
      ...input,
      tenantId: TENANT_ID,
      abstract: null,
      fileId: null,
      publishedAt: null,
      tags: [],
      language: 'EN',
      dataClassification: 'PUBLIC',
      createdBy: USER_ID,
      updatedBy: USER_ID,
    };

    prisma.publication.findFirst.mockResolvedValue(null); // no duplicate
    prisma.publication.create.mockResolvedValue(created);

    const user = createMockUser();
    const result = await service.create(input, user as never);

    expect(result).toEqual({ data: created });

    // Verify Prisma create was called with correct tenant and user data
    expect(prisma.publication.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: TENANT_ID,
          title: 'Test Publication',
          authors: ['Author 1'],
          domain: 'ANIMAL_HEALTH',
          type: 'BRIEF',
          dataClassification: 'PUBLIC',
          language: 'EN',
          createdBy: USER_ID,
          updatedBy: USER_ID,
        }),
      }),
    );

    // Verify Kafka event was published
    expect(kafka.send).toHaveBeenCalledWith(
      'au.knowledge.publication.created.v1',
      'pub-1',
      expect.objectContaining({ id: 'pub-1', title: 'Test Publication' }),
      expect.objectContaining({
        sourceService: 'knowledge-hub-service',
        tenantId: TENANT_ID,
        userId: USER_ID,
      }),
    );
  });

  // Test 2: create -- throws 409 if duplicate title in same tenant
  it('create -- throws 409 if duplicate title exists in the same tenant', async () => {
    const input = {
      title: 'Duplicate Title',
      authors: ['Author 1'],
      domain: 'ANIMAL_HEALTH',
      type: 'BRIEF' as const,
    };

    prisma.publication.findFirst.mockResolvedValue({
      id: 'existing-pub',
      title: 'Duplicate Title',
      tenantId: TENANT_ID,
    });

    const user = createMockUser();

    await expect(service.create(input, user as never)).rejects.toThrow(
      expect.objectContaining({
        message: expect.stringContaining('already exists'),
      }),
    );

    // Verify the error has statusCode 409
    try {
      await service.create(input, user as never);
    } catch (err: unknown) {
      expect((err as Error & { statusCode: number }).statusCode).toBe(409);
    }

    // Verify create was never called
    expect(prisma.publication.create).not.toHaveBeenCalled();
  });

  // Test 3: findAll -- returns paginated results with meta
  it('findAll -- returns paginated results with meta', async () => {
    const publications = [
      { id: 'pub-1', title: 'Publication 1', tenantId: TENANT_ID },
      { id: 'pub-2', title: 'Publication 2', tenantId: TENANT_ID },
    ];

    prisma.publication.findMany.mockResolvedValue(publications);
    prisma.publication.count.mockResolvedValue(25);

    const user = createMockUser();
    const result = await service.findAll(user as never, { page: 2, limit: 10 });

    expect(result.data).toEqual(publications);
    expect(result.meta).toEqual({ total: 25, page: 2, limit: 10 });

    // Verify skip/take pagination was applied
    expect(prisma.publication.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10, // (page 2 - 1) * limit 10
        take: 10,
      }),
    );
  });

  // Test 4: findOne -- throws 404 for non-existent publication
  it('findOne -- throws 404 for non-existent publication', async () => {
    prisma.publication.findUnique.mockResolvedValue(null);

    const user = createMockUser();

    await expect(service.findOne('non-existent-id', user as never)).rejects.toThrow(
      expect.objectContaining({
        message: expect.stringContaining('not found'),
      }),
    );

    try {
      await service.findOne('non-existent-id', user as never);
    } catch (err: unknown) {
      expect((err as Error & { statusCode: number }).statusCode).toBe(404);
    }
  });

  // Test 5: download -- returns download URL when file exists, throws 404 when no file
  it('download -- returns download URL when file exists, throws 404 when no file attached', async () => {
    const user = createMockUser();
    const publicationWithFile = {
      id: 'pub-with-file',
      title: 'Publication With File',
      tenantId: TENANT_ID,
      fileId: 'file-uuid-123',
    };
    const publicationWithoutFile = {
      id: 'pub-no-file',
      title: 'Publication Without File',
      tenantId: TENANT_ID,
      fileId: null,
    };

    // Case 1: publication has a file -- should return download URL
    prisma.publication.findUnique.mockResolvedValue(publicationWithFile);

    const result = await service.download('pub-with-file', user as never);

    expect(result.data).toHaveProperty('downloadUrl');
    expect(result.data.downloadUrl).toContain('file-uuid-123');
    expect(result.data.downloadUrl).toContain('/api/v1/drive/files/');

    // Case 2: publication has no file -- should throw 404
    prisma.publication.findUnique.mockResolvedValue(publicationWithoutFile);

    try {
      await service.download('pub-no-file', user as never);
      expect.fail('Should have thrown an error');
    } catch (err: unknown) {
      expect((err as Error & { statusCode: number }).statusCode).toBe(404);
      expect((err as Error).message).toContain('no attached file');
    }

    // Case 3: publication does not exist -- should throw 404
    prisma.publication.findUnique.mockResolvedValue(null);

    try {
      await service.download('non-existent', user as never);
      expect.fail('Should have thrown an error');
    } catch (err: unknown) {
      expect((err as Error & { statusCode: number }).statusCode).toBe(404);
      expect((err as Error).message).toContain('not found');
    }
  });
});

// ── ELearningService ──

describe('ELearningService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let kafka: ReturnType<typeof createMockKafka>;
  let service: ELearningService;

  beforeEach(() => {
    prisma = createMockPrisma();
    kafka = createMockKafka();
    service = new ELearningService(prisma as never, kafka as never);
  });

  // Test 6: create -- creates e-learning module and publishes event
  it('create -- creates e-learning module and publishes Kafka event', async () => {
    const input = {
      title: 'Introduction to Animal Health Surveillance',
      description: 'Learn about surveillance systems.',
      domain: 'ANIMAL_HEALTH',
      lessons: [
        { id: 'l1', title: 'Lesson 1' },
        { id: 'l2', title: 'Lesson 2' },
      ],
      estimatedDuration: 120,
    };

    const created = {
      id: 'elearn-1',
      ...input,
      tenantId: TENANT_ID,
      prerequisiteIds: [],
      publishedAt: null,
      dataClassification: 'PUBLIC',
      createdBy: USER_ID,
      updatedBy: USER_ID,
    };

    prisma.eLearningModule.create.mockResolvedValue(created);

    const user = createMockUser();
    const result = await service.create(input, user as never);

    expect(result).toEqual({ data: created });

    // Verify Prisma create was called with correct data
    expect(prisma.eLearningModule.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: TENANT_ID,
          title: 'Introduction to Animal Health Surveillance',
          domain: 'ANIMAL_HEALTH',
          estimatedDuration: 120,
          dataClassification: 'PUBLIC',
          createdBy: USER_ID,
          updatedBy: USER_ID,
        }),
      }),
    );

    // Verify Kafka event was published
    expect(kafka.send).toHaveBeenCalledWith(
      'au.knowledge.elearning.created.v1',
      'elearn-1',
      expect.objectContaining({ id: 'elearn-1', title: 'Introduction to Animal Health Surveillance' }),
      expect.objectContaining({
        sourceService: 'knowledge-hub-service',
        tenantId: TENANT_ID,
        userId: USER_ID,
      }),
    );
  });

  // Test 7: enroll -- creates learner progress, returns existing if already enrolled
  it('enroll -- creates learner progress for new enrollment, returns existing if already enrolled', async () => {
    const moduleId = 'elearn-mod-1';
    const user = createMockUser();

    const mockModule = {
      id: moduleId,
      title: 'Test Module',
      tenantId: TENANT_ID,
    };

    const newProgress = {
      id: 'progress-1',
      userId: USER_ID,
      moduleId,
      completedLessons: [],
      score: null,
      startedAt: new Date(),
      completedAt: null,
    };

    // Case 1: New enrollment -- module exists, no existing progress
    prisma.eLearningModule.findUnique.mockResolvedValue(mockModule);
    prisma.learnerProgress.findUnique.mockResolvedValue(null);
    prisma.learnerProgress.create.mockResolvedValue(newProgress);

    const result = await service.enroll(moduleId, user as never);

    expect(result).toEqual({ data: newProgress });
    expect(prisma.learnerProgress.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: USER_ID,
          moduleId,
          completedLessons: expect.anything(),
          score: null,
          completedAt: null,
        }),
      }),
    );

    // Case 2: Already enrolled -- returns existing progress without creating new one
    const existingProgress = {
      id: 'progress-existing',
      userId: USER_ID,
      moduleId,
      completedLessons: ['l1'],
      score: null,
      startedAt: new Date(),
      completedAt: null,
    };

    prisma.learnerProgress.findUnique.mockResolvedValue(existingProgress);
    prisma.learnerProgress.create.mockClear();

    const result2 = await service.enroll(moduleId, user as never);

    expect(result2).toEqual({ data: existingProgress });
    // create should NOT have been called again
    expect(prisma.learnerProgress.create).not.toHaveBeenCalled();
  });

  // Test 8: updateProgress -- sets completedAt when all lessons completed
  it('updateProgress -- sets completedAt when all lessons are completed', async () => {
    const moduleId = 'elearn-mod-2';
    const user = createMockUser();

    const existingEnrollment = {
      id: 'progress-2',
      userId: USER_ID,
      moduleId,
      completedLessons: ['l1'],
      score: null,
      startedAt: new Date(),
      completedAt: null,
    };

    // Module with 3 lessons
    const mockModule = {
      id: moduleId,
      title: 'Full Module',
      tenantId: TENANT_ID,
      lessons: [
        { id: 'l1', title: 'Lesson 1' },
        { id: 'l2', title: 'Lesson 2' },
        { id: 'l3', title: 'Lesson 3' },
      ],
    };

    prisma.learnerProgress.findUnique.mockResolvedValue(existingEnrollment);
    prisma.eLearningModule.findUnique.mockResolvedValue(mockModule);

    const updatedProgress = {
      ...existingEnrollment,
      completedLessons: ['l1', 'l2', 'l3'],
      completedAt: new Date(),
    };
    prisma.learnerProgress.update.mockResolvedValue(updatedProgress);

    // All 3 lessons completed
    const dto = {
      completedLessons: ['l1', 'l2', 'l3'],
    };

    const result = await service.updateProgress(moduleId, dto, user as never);

    expect(result).toEqual({ data: updatedProgress });

    // Verify that completedAt is set (since all 3 lessons are done)
    expect(prisma.learnerProgress.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          completedLessons: ['l1', 'l2', 'l3'],
          completedAt: expect.any(Date),
        }),
      }),
    );
  });
});

// ── FaqService ──

describe('FaqService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let kafka: ReturnType<typeof createMockKafka>;
  let service: FaqService;

  beforeEach(() => {
    prisma = createMockPrisma();
    kafka = createMockKafka();
    service = new FaqService(prisma as never, kafka as never);
  });

  // Test 9: create -- creates FAQ with defaults (language: EN, sortOrder: 0)
  it('create -- creates FAQ with default language EN and sortOrder 0', async () => {
    const input = {
      question: 'What is ARIS 4.0?',
      answer: 'ARIS is the Animal Resources Information System.',
      domain: 'KNOWLEDGE_MANAGEMENT',
    };

    const created = {
      id: 'faq-1',
      ...input,
      language: 'EN',
      sortOrder: 0,
      dataClassification: 'PUBLIC',
      tenantId: TENANT_ID,
      createdBy: USER_ID,
      updatedBy: USER_ID,
    };

    prisma.fAQ.create.mockResolvedValue(created);

    const user = createMockUser();
    const result = await service.create(input, user as never);

    expect(result).toEqual({ data: created });

    // Verify defaults are applied
    expect(prisma.fAQ.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          question: 'What is ARIS 4.0?',
          answer: 'ARIS is the Animal Resources Information System.',
          domain: 'KNOWLEDGE_MANAGEMENT',
          language: 'EN',
          sortOrder: 0,
          dataClassification: 'PUBLIC',
          tenantId: TENANT_ID,
          createdBy: USER_ID,
          updatedBy: USER_ID,
        }),
      }),
    );

    // Verify Kafka event was published
    expect(kafka.send).toHaveBeenCalledWith(
      'au.knowledge.faq.created.v1',
      'faq-1',
      expect.objectContaining({ id: 'faq-1' }),
      expect.objectContaining({
        sourceService: 'knowledge-hub-service',
        tenantId: TENANT_ID,
      }),
    );
  });

  // Test 10: findOne -- MEMBER_STATE user cannot access another tenant's FAQ (throws 404)
  it('findOne -- MEMBER_STATE user cannot access another tenant FAQ (throws 404)', async () => {
    // FAQ belongs to TENANT_ID
    const faq = {
      id: 'faq-other',
      question: 'Restricted FAQ',
      answer: 'Should not be visible.',
      domain: 'ANIMAL_HEALTH',
      language: 'EN',
      sortOrder: 0,
      dataClassification: 'PUBLIC',
      tenantId: TENANT_ID,
    };

    prisma.fAQ.findUnique.mockResolvedValue(faq);

    // User belongs to a DIFFERENT tenant at MEMBER_STATE level
    const otherTenantUser = createMockUser({
      tenantId: OTHER_TENANT_ID,
      tenantLevel: 'MEMBER_STATE' as const,
      role: 'NATIONAL_ADMIN' as const,
      email: 'admin@ng.au-aris.org',
    });

    await expect(service.findOne('faq-other', otherTenantUser as never)).rejects.toThrow(
      expect.objectContaining({
        message: expect.stringContaining('not found'),
      }),
    );

    // Verify the error has statusCode 404 (security: don't reveal existence)
    try {
      await service.findOne('faq-other', otherTenantUser as never);
      expect.fail('Should have thrown an error');
    } catch (err: unknown) {
      expect((err as Error & { statusCode: number }).statusCode).toBe(404);
    }
  });
});

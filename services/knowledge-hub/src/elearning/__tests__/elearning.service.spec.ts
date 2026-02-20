import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { ELearningService } from '../elearning.service';
import { TenantLevel, UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

// ── Mock factories ──

function mockPrismaService() {
  return {
    eLearningModule: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    learnerProgress: {
      create: vi.fn(),
      findUnique: vi.fn(),
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
    email: 'admin@aris.africa',
    role: UserRole.SUPER_ADMIN,
    tenantId: 'tenant-au',
    tenantLevel: TenantLevel.CONTINENTAL,
    ...overrides,
  };
}

function msUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    userId: 'user-ke',
    email: 'admin@ke.aris.africa',
    role: UserRole.NATIONAL_ADMIN,
    tenantId: 'tenant-ke',
    tenantLevel: TenantLevel.MEMBER_STATE,
    ...overrides,
  };
}

function moduleFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'module-1',
    tenantId: 'tenant-au',
    title: 'Introduction to Animal Health Surveillance',
    description: 'A comprehensive course on surveillance systems.',
    domain: 'animal-health',
    lessons: [
      { id: 'L1', title: 'Lesson 1' },
      { id: 'L2', title: 'Lesson 2' },
      { id: 'L3', title: 'Lesson 3' },
    ],
    estimatedDuration: 60,
    prerequisiteIds: [],
    publishedAt: new Date('2024-06-01'),
    dataClassification: 'PUBLIC',
    createdBy: 'user-au',
    updatedBy: 'user-au',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

function progressFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'progress-1',
    userId: 'user-ke',
    moduleId: 'module-1',
    completedLessons: [],
    score: null,
    startedAt: new Date('2024-07-01'),
    completedAt: null,
    createdAt: new Date('2024-07-01'),
    updatedAt: new Date('2024-07-01'),
    ...overrides,
  };
}

// ── Tests ──

describe('ELearningService', () => {
  let service: ELearningService;
  let prisma: ReturnType<typeof mockPrismaService>;
  let kafka: ReturnType<typeof mockKafkaProducer>;

  beforeEach(() => {
    prisma = mockPrismaService();
    kafka = mockKafkaProducer();
    service = new ELearningService(prisma as never, kafka as never);
  });

  // ── enroll ──

  describe('enroll', () => {
    it('should create new enrollment for a module', async () => {
      const mod = moduleFixture();
      const progress = progressFixture();

      prisma.eLearningModule.findUnique.mockResolvedValue(mod);
      prisma.learnerProgress.findUnique.mockResolvedValue(null);
      prisma.learnerProgress.create.mockResolvedValue(progress);

      const result = await service.enroll('module-1', msUser());

      expect(result.data).toEqual(progress);
      expect(prisma.learnerProgress.create).toHaveBeenCalledOnce();
      expect(prisma.learnerProgress.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-ke',
            moduleId: 'module-1',
          }),
        }),
      );
    });

    it('should return existing enrollment if already enrolled', async () => {
      const mod = moduleFixture();
      const existingProgress = progressFixture({ completedLessons: ['L1'] });

      prisma.eLearningModule.findUnique.mockResolvedValue(mod);
      prisma.learnerProgress.findUnique.mockResolvedValue(existingProgress);

      const result = await service.enroll('module-1', msUser());

      expect(result.data).toEqual(existingProgress);
      expect(prisma.learnerProgress.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if module does not exist', async () => {
      prisma.eLearningModule.findUnique.mockResolvedValue(null);

      await expect(
        service.enroll('nonexistent-module', msUser()),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── updateProgress ──

  describe('updateProgress', () => {
    it('should update completed lessons', async () => {
      const mod = moduleFixture();
      const progress = progressFixture();
      const updatedProgress = progressFixture({
        completedLessons: ['L1', 'L2'],
        completedAt: null,
      });

      prisma.learnerProgress.findUnique.mockResolvedValue(progress);
      prisma.eLearningModule.findUnique.mockResolvedValue(mod);
      prisma.learnerProgress.update.mockResolvedValue(updatedProgress);

      const result = await service.updateProgress(
        'module-1',
        { completedLessons: ['L1', 'L2'] },
        msUser(),
      );

      expect(result.data.completedLessons).toEqual(['L1', 'L2']);
      expect(result.data.completedAt).toBeNull();
      // When not all lessons are done, completedAt should NOT be in the update data
      const updateCall = prisma.learnerProgress.update.mock.calls[0][0];
      expect(updateCall.data.completedLessons).toEqual(['L1', 'L2']);
      expect(updateCall.data).not.toHaveProperty('completedAt');
    });

    it('should set completedAt when all lessons are completed', async () => {
      const mod = moduleFixture();
      const progress = progressFixture({ completedLessons: ['L1', 'L2'] });
      const now = new Date();
      const updatedProgress = progressFixture({
        completedLessons: ['L1', 'L2', 'L3'],
        completedAt: now,
      });

      prisma.learnerProgress.findUnique.mockResolvedValue(progress);
      prisma.eLearningModule.findUnique.mockResolvedValue(mod);
      prisma.learnerProgress.update.mockResolvedValue(updatedProgress);

      const result = await service.updateProgress(
        'module-1',
        { completedLessons: ['L1', 'L2', 'L3'] },
        msUser(),
      );

      expect(result.data.completedLessons).toEqual(['L1', 'L2', 'L3']);
      expect(result.data.completedAt).toBeInstanceOf(Date);
      expect(prisma.learnerProgress.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            completedLessons: ['L1', 'L2', 'L3'],
            completedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should set score when provided', async () => {
      const mod = moduleFixture();
      const progress = progressFixture({ completedLessons: ['L1'] });
      const updatedProgress = progressFixture({
        completedLessons: ['L1'],
        score: 85,
      });

      prisma.learnerProgress.findUnique.mockResolvedValue(progress);
      prisma.eLearningModule.findUnique.mockResolvedValue(mod);
      prisma.learnerProgress.update.mockResolvedValue(updatedProgress);

      const result = await service.updateProgress(
        'module-1',
        { completedLessons: ['L1'], score: 85 },
        msUser(),
      );

      expect(result.data.score).toBe(85);
      expect(prisma.learnerProgress.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            score: 85,
          }),
        }),
      );
    });

    it('should throw NotFoundException if not enrolled', async () => {
      prisma.learnerProgress.findUnique.mockResolvedValue(null);

      await expect(
        service.updateProgress(
          'module-1',
          { completedLessons: ['L1'] },
          msUser(),
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── getMyCourses ──

  describe('getMyCourses', () => {
    it('should return all enrolled courses for user', async () => {
      const progresses = [
        progressFixture({ id: 'progress-1', moduleId: 'module-1' }),
        progressFixture({ id: 'progress-2', moduleId: 'module-2' }),
      ];

      prisma.learnerProgress.findMany.mockResolvedValue(progresses);

      const result = await service.getMyCourses(msUser());

      expect(result.data).toHaveLength(2);
      expect(prisma.learnerProgress.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-ke',
          }),
        }),
      );
    });
  });

  // ── findAll ──

  describe('findAll', () => {
    it('should filter by tenant level', async () => {
      const modules = [moduleFixture()];
      prisma.eLearningModule.findMany.mockResolvedValue(modules);
      prisma.eLearningModule.count.mockResolvedValue(1);

      const result = await service.findAll(continentalUser(), {});

      expect(result.data).toHaveLength(1);
      // CONTINENTAL should pass empty where clause
      expect(prisma.eLearningModule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });
  });
});

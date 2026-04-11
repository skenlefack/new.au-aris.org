import { v4 as uuidv4 } from 'uuid';
import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import {
  UserRole,
  TOPIC_AU_KNOWLEDGE_COURSE_CREATED,
  TOPIC_AU_KNOWLEDGE_COURSE_UPDATED,
  TOPIC_AU_KNOWLEDGE_COURSE_DELETED,
  TOPIC_AU_KNOWLEDGE_COURSE_PUBLISHED,
  TOPIC_AU_KNOWLEDGE_COURSE_ARCHIVED,
  TOPIC_AU_KNOWLEDGE_ENROLLMENT_CREATED,
  TOPIC_AU_KNOWLEDGE_ENROLLMENT_COMPLETED,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from '@aris/shared-types';
import type { KafkaHeaders, ApiResponse, PaginatedResponse } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import type {
  CreateCourseInput,
  UpdateCourseInput,
  CourseFilterInput,
  AddModuleInput,
  UpdateModuleInput,
  ReorderModulesInput,
} from '../schemas/knowledge.schema';

const SERVICE_NAME = 'knowledge-hub-service';

type CourseStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

const ADMIN_ROLES = new Set<string>([
  UserRole.SUPER_ADMIN,
  UserRole.CONTINENTAL_ADMIN,
  UserRole.KNOWLEDGE_MANAGER,
]);

interface CourseRecord {
  id: string;
  tenantId: string;
  title: Record<string, string>;
  description: Record<string, string> | null;
  coverImageId: string | null;
  domain: string | null;
  tags: string[];
  status: CourseStatus;
  estimatedHours: number | null;
  createdBy: string;
  updatedBy: string;
  publishedAt: Date | null;
  publishedBy: string | null;
  archivedAt: Date | null;
  modules?: ModuleRecord[];
  enrollments?: EnrollmentRecord[];
  createdAt: Date;
  updatedAt: Date;
}

interface ModuleRecord {
  id: string;
  courseId: string;
  title: Record<string, string>;
  content: Record<string, string>;
  sortOrder: number;
  durationMinutes: number;
  createdAt: Date;
  updatedAt: Date;
}

interface EnrollmentRecord {
  id: string;
  userId: string;
  courseId: string;
  progress: number;
  completedModules: string[];
  enrolledAt: Date;
  completedAt: Date | null;
}

export class ElearningService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: StandaloneKafkaProducer,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // Course CRUD
  // ─────────────────────────────────────────────────────────────

  async createCourse(dto: CreateCourseInput, user: AuthenticatedUser): Promise<ApiResponse<CourseRecord>> {
    this.assertAdmin(user);

    const course = await (this.prisma as any).knowledgeCourse.create({
      data: {
        tenantId: user.tenantId,
        title: dto.title,
        description: dto.description ?? null,
        coverImageId: dto.coverImageId ?? null,
        domain: dto.domain ?? null,
        tags: dto.tags ?? [],
        estimatedHours: dto.estimatedHours ?? null,
        status: 'DRAFT',
        createdBy: user.userId,
        updatedBy: user.userId,
        modules: dto.modules && dto.modules.length > 0 ? {
          create: dto.modules.map((m, i) => ({
            title: m.title,
            content: m.content,
            sortOrder: m.sortOrder ?? i,
            durationMinutes: m.durationMinutes ?? 0,
          })),
        } : undefined,
      },
      include: { modules: { orderBy: { sortOrder: 'asc' } } },
    });

    await this.publishEvent(TOPIC_AU_KNOWLEDGE_COURSE_CREATED, course, user);
    return { data: course };
  }

  async updateCourse(id: string, dto: UpdateCourseInput, user: AuthenticatedUser): Promise<ApiResponse<CourseRecord>> {
    this.assertAdmin(user);

    const existing = await (this.prisma as any).knowledgeCourse.findUnique({ where: { id } });
    if (!existing) throw this.httpError(404, 'Course not found');
    if (existing.status === 'ARCHIVED') {
      throw this.httpError(409, 'Cannot edit an archived course');
    }

    const course = await (this.prisma as any).knowledgeCourse.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.coverImageId !== undefined && { coverImageId: dto.coverImageId }),
        ...(dto.domain !== undefined && { domain: dto.domain }),
        ...(dto.tags !== undefined && { tags: dto.tags }),
        ...(dto.estimatedHours !== undefined && { estimatedHours: dto.estimatedHours }),
        updatedBy: user.userId,
      },
      include: { modules: { orderBy: { sortOrder: 'asc' } } },
    });

    await this.publishEvent(TOPIC_AU_KNOWLEDGE_COURSE_UPDATED, course, user);
    return { data: course };
  }

  async deleteCourse(id: string, user: AuthenticatedUser): Promise<ApiResponse<{ deleted: boolean }>> {
    this.assertAdmin(user);

    const existing = await (this.prisma as any).knowledgeCourse.findUnique({ where: { id } });
    if (!existing) throw this.httpError(404, 'Course not found');

    // Soft delete: archive instead of hard delete if there are enrollments
    const enrollmentCount = await (this.prisma as any).knowledgeEnrollment.count({ where: { courseId: id } });
    if (enrollmentCount > 0) {
      await (this.prisma as any).knowledgeCourse.update({
        where: { id },
        data: { status: 'ARCHIVED', archivedAt: new Date(), updatedBy: user.userId },
      });
    } else {
      await (this.prisma as any).knowledgeCourse.delete({ where: { id } });
    }

    await this.publishEvent(TOPIC_AU_KNOWLEDGE_COURSE_DELETED, existing, user);
    return { data: { deleted: true } };
  }

  async publishCourse(id: string, user: AuthenticatedUser): Promise<ApiResponse<CourseRecord>> {
    this.assertAdmin(user);

    const existing = await (this.prisma as any).knowledgeCourse.findUnique({
      where: { id },
      include: { modules: true },
    });
    if (!existing) throw this.httpError(404, 'Course not found');
    if (existing.status !== 'DRAFT') {
      throw this.httpError(409, `Only DRAFT courses can be published (current: ${existing.status})`);
    }
    if (!existing.modules || existing.modules.length === 0) {
      throw this.httpError(400, 'Cannot publish a course with no modules');
    }

    const course = await (this.prisma as any).knowledgeCourse.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        publishedBy: user.userId,
        updatedBy: user.userId,
      },
      include: { modules: { orderBy: { sortOrder: 'asc' } } },
    });

    await this.publishEvent(TOPIC_AU_KNOWLEDGE_COURSE_PUBLISHED, course, user);
    return { data: course };
  }

  async archiveCourse(id: string, user: AuthenticatedUser): Promise<ApiResponse<CourseRecord>> {
    this.assertAdmin(user);

    const existing = await (this.prisma as any).knowledgeCourse.findUnique({ where: { id } });
    if (!existing) throw this.httpError(404, 'Course not found');

    const course = await (this.prisma as any).knowledgeCourse.update({
      where: { id },
      data: { status: 'ARCHIVED', archivedAt: new Date(), updatedBy: user.userId },
      include: { modules: { orderBy: { sortOrder: 'asc' } } },
    });

    await this.publishEvent(TOPIC_AU_KNOWLEDGE_COURSE_ARCHIVED, course, user);
    return { data: course };
  }

  // ─────────────────────────────────────────────────────────────
  // Course Read
  // ─────────────────────────────────────────────────────────────

  async findOneCourse(id: string, user: AuthenticatedUser | null): Promise<ApiResponse<CourseRecord>> {
    const course = await (this.prisma as any).knowledgeCourse.findUnique({
      where: { id },
      include: {
        modules: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { enrollments: true } },
      },
    });
    if (!course) throw this.httpError(404, 'Course not found');

    // Non-admin users can only see PUBLISHED courses
    if (!user || !this.isAdmin(user)) {
      if (course.status !== 'PUBLISHED') throw this.httpError(404, 'Course not found');
    }

    return { data: course };
  }

  async findAllCourses(
    user: AuthenticatedUser | null,
    query: CourseFilterInput,
  ): Promise<PaginatedResponse<CourseRecord>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (!user || !this.isAdmin(user)) {
      // Public and non-admin users only see PUBLISHED
      where.status = 'PUBLISHED';
    } else if (query.status) {
      where.status = query.status;
    }

    if (query.domain) where.domain = query.domain;
    if (query.search) {
      where.tags = { has: query.search };
    }

    const [data, total] = await Promise.all([
      (this.prisma as any).knowledgeCourse.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          modules: { orderBy: { sortOrder: 'asc' }, select: { id: true, title: true, sortOrder: true, durationMinutes: true } },
          _count: { select: { enrollments: true } },
        },
      }),
      (this.prisma as any).knowledgeCourse.count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  // ─────────────────────────────────────────────────────────────
  // Module Management
  // ─────────────────────────────────────────────────────────────

  async addModule(courseId: string, dto: AddModuleInput, user: AuthenticatedUser): Promise<ApiResponse<ModuleRecord>> {
    this.assertAdmin(user);

    const course = await (this.prisma as any).knowledgeCourse.findUnique({ where: { id: courseId } });
    if (!course) throw this.httpError(404, 'Course not found');
    if (course.status === 'ARCHIVED') throw this.httpError(409, 'Cannot add modules to an archived course');

    // If no sortOrder, place at end
    let sortOrder = dto.sortOrder;
    if (sortOrder === undefined) {
      const maxOrder = await (this.prisma as any).knowledgeCourseModule.aggregate({
        where: { courseId },
        _max: { sortOrder: true },
      });
      sortOrder = (maxOrder._max?.sortOrder ?? -1) + 1;
    }

    const module = await (this.prisma as any).knowledgeCourseModule.create({
      data: {
        courseId,
        title: dto.title,
        content: dto.content,
        sortOrder,
        durationMinutes: dto.durationMinutes ?? 0,
      },
    });

    // Update course updatedBy
    await (this.prisma as any).knowledgeCourse.update({
      where: { id: courseId },
      data: { updatedBy: user.userId },
    });

    return { data: module };
  }

  async updateModule(
    courseId: string,
    moduleId: string,
    dto: AddModuleInput | Record<string, unknown>,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<ModuleRecord>> {
    this.assertAdmin(user);

    const module = await (this.prisma as any).knowledgeCourseModule.findUnique({ where: { id: moduleId } });
    if (!module || module.courseId !== courseId) throw this.httpError(404, 'Module not found');

    const updated = await (this.prisma as any).knowledgeCourseModule.update({
      where: { id: moduleId },
      data: {
        ...((dto as any).title !== undefined && { title: (dto as any).title }),
        ...((dto as any).content !== undefined && { content: (dto as any).content }),
        ...((dto as any).sortOrder !== undefined && { sortOrder: (dto as any).sortOrder }),
        ...((dto as any).durationMinutes !== undefined && { durationMinutes: (dto as any).durationMinutes }),
      },
    });

    await (this.prisma as any).knowledgeCourse.update({
      where: { id: courseId },
      data: { updatedBy: user.userId },
    });

    return { data: updated };
  }

  async reorderModules(courseId: string, dto: ReorderModulesInput, user: AuthenticatedUser): Promise<ApiResponse<ModuleRecord[]>> {
    this.assertAdmin(user);

    const course = await (this.prisma as any).knowledgeCourse.findUnique({ where: { id: courseId } });
    if (!course) throw this.httpError(404, 'Course not found');

    // Update sort order for each module in the provided order
    await (this.prisma as any).$transaction(
      dto.moduleIds.map((moduleId: string, index: number) =>
        (this.prisma as any).knowledgeCourseModule.update({
          where: { id: moduleId },
          data: { sortOrder: index },
        }),
      ),
    );

    await (this.prisma as any).knowledgeCourse.update({
      where: { id: courseId },
      data: { updatedBy: user.userId },
    });

    const modules = await (this.prisma as any).knowledgeCourseModule.findMany({
      where: { courseId },
      orderBy: { sortOrder: 'asc' },
    });

    return { data: modules };
  }

  async removeModule(courseId: string, moduleId: string, user: AuthenticatedUser): Promise<ApiResponse<{ deleted: boolean }>> {
    this.assertAdmin(user);

    const module = await (this.prisma as any).knowledgeCourseModule.findUnique({ where: { id: moduleId } });
    if (!module || module.courseId !== courseId) throw this.httpError(404, 'Module not found');

    await (this.prisma as any).knowledgeCourseModule.delete({ where: { id: moduleId } });

    await (this.prisma as any).knowledgeCourse.update({
      where: { id: courseId },
      data: { updatedBy: user.userId },
    });

    return { data: { deleted: true } };
  }

  // ─────────────────────────────────────────────────────────────
  // Enrollment & Progress
  // ─────────────────────────────────────────────────────────────

  async enroll(courseId: string, user: AuthenticatedUser): Promise<ApiResponse<EnrollmentRecord>> {
    const course = await (this.prisma as any).knowledgeCourse.findUnique({ where: { id: courseId } });
    if (!course) throw this.httpError(404, 'Course not found');
    if (course.status !== 'PUBLISHED') {
      throw this.httpError(409, 'Can only enroll in published courses');
    }

    // Check if already enrolled
    const existing = await (this.prisma as any).knowledgeEnrollment.findUnique({
      where: { userId_courseId: { userId: user.userId, courseId } },
    });
    if (existing) {
      return { data: existing };
    }

    const enrollment = await (this.prisma as any).knowledgeEnrollment.create({
      data: {
        userId: user.userId,
        courseId,
        progress: 0,
        completedModules: [],
      },
    });

    await this.publishEvent(TOPIC_AU_KNOWLEDGE_ENROLLMENT_CREATED, { id: enrollment.id, courseId, userId: user.userId }, user);
    return { data: enrollment };
  }

  async getProgress(courseId: string, user: AuthenticatedUser): Promise<ApiResponse<EnrollmentRecord | null>> {
    const enrollment = await (this.prisma as any).knowledgeEnrollment.findUnique({
      where: { userId_courseId: { userId: user.userId, courseId } },
    });
    return { data: enrollment ?? null };
  }

  async completeModule(
    courseId: string,
    moduleId: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<EnrollmentRecord>> {
    // Verify module belongs to course
    const module = await (this.prisma as any).knowledgeCourseModule.findUnique({ where: { id: moduleId } });
    if (!module || module.courseId !== courseId) throw this.httpError(404, 'Module not found');

    // Get or create enrollment
    let enrollment = await (this.prisma as any).knowledgeEnrollment.findUnique({
      where: { userId_courseId: { userId: user.userId, courseId } },
    });
    if (!enrollment) {
      throw this.httpError(409, 'You are not enrolled in this course');
    }

    // Add module to completed list if not already there
    const completedModules: string[] = enrollment.completedModules ?? [];
    if (!completedModules.includes(moduleId)) {
      completedModules.push(moduleId);
    }

    // Calculate progress as percentage of total modules
    const totalModules = await (this.prisma as any).knowledgeCourseModule.count({ where: { courseId } });
    const progress = totalModules > 0 ? Math.round((completedModules.length / totalModules) * 100) : 0;
    const isComplete = progress >= 100;

    enrollment = await (this.prisma as any).knowledgeEnrollment.update({
      where: { id: enrollment.id },
      data: {
        completedModules,
        progress,
        ...(isComplete && !enrollment.completedAt && { completedAt: new Date() }),
      },
    });

    if (isComplete && !enrollment.completedAt) {
      await this.publishEvent(
        TOPIC_AU_KNOWLEDGE_ENROLLMENT_COMPLETED,
        { id: enrollment.id, courseId, userId: user.userId, progress },
        user,
      );
    }

    return { data: enrollment };
  }

  async getUserCourses(user: AuthenticatedUser): Promise<ApiResponse<EnrollmentRecord[]>> {
    const enrollments = await (this.prisma as any).knowledgeEnrollment.findMany({
      where: { userId: user.userId },
      include: {
        course: {
          include: {
            modules: { orderBy: { sortOrder: 'asc' }, select: { id: true, title: true, sortOrder: true, durationMinutes: true } },
          },
        },
      },
      orderBy: { enrolledAt: 'desc' },
    });
    return { data: enrollments };
  }

  // ─────────────────────────────────────────────────────────────
  // Internals
  // ─────────────────────────────────────────────────────────────

  private isAdmin(user: AuthenticatedUser): boolean {
    return !!user.roles?.some((r) => ADMIN_ROLES.has(r));
  }

  private assertAdmin(user: AuthenticatedUser): void {
    if (!this.isAdmin(user)) {
      throw this.httpError(403, 'Only knowledge managers can perform this action');
    }
  }

  private httpError(statusCode: number, message: string): Error & { statusCode: number } {
    const err = new Error(message) as Error & { statusCode: number };
    err.statusCode = statusCode;
    return err;
  }

  private async publishEvent(
    topic: string,
    payload: { id: string; [key: string]: unknown },
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
      await this.kafka.send(topic, payload.id as string, payload, headers);
    } catch (err) {
      console.error(`[ElearningService] Failed to publish ${topic}:`, err instanceof Error ? err.message : err);
    }
  }
}

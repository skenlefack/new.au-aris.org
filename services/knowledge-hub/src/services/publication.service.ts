import { v4 as uuidv4 } from 'uuid';
import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import {
  TenantLevel,
  UserRole,
  DataClassification,
  TOPIC_AU_KNOWLEDGE_PUBLICATION_CREATED,
  TOPIC_AU_KNOWLEDGE_PUBLICATION_UPDATED,
  TOPIC_AU_KNOWLEDGE_PUBLICATION_DELETED,
  TOPIC_AU_KNOWLEDGE_PUBLICATION_SUBMITTED,
  TOPIC_AU_KNOWLEDGE_PUBLICATION_APPROVED,
  TOPIC_AU_KNOWLEDGE_PUBLICATION_REJECTED,
  TOPIC_AU_KNOWLEDGE_PUBLICATION_PUBLISHED,
  TOPIC_AU_KNOWLEDGE_PUBLICATION_ARCHIVED,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from '@aris/shared-types';
import type { KafkaHeaders, ApiResponse, PaginatedResponse } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import type {
  CreatePublicationInput,
  UpdatePublicationInput,
  PublicationFilterInput,
  ReviewPublicationInput,
} from '../schemas/knowledge.schema';
import type { CategoryService } from './category.service';
import type { SearchService } from './search.service';

const SERVICE_NAME = 'knowledge-hub-service';

const REVIEWER_ROLES = new Set<string>([
  UserRole.SUPER_ADMIN,
  UserRole.CONTINENTAL_ADMIN,
  UserRole.KNOWLEDGE_MANAGER,
]);

type PublicationStatus =
  | 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'PUBLISHED' | 'ARCHIVED';

interface PublicationRecord {
  id: string;
  tenantId: string;
  categoryId: string;
  title: Record<string, string>;
  summary: Record<string, string> | null;
  contentHtml: Record<string, string>;
  contentText: Record<string, string> | null;
  slug: string;
  type: string;
  status: PublicationStatus;
  visibility: 'PUBLIC' | 'PRIVATE';
  dataClassification: string;
  authors: string[];
  tags: string[];
  coverImageId: string | null;
  createdBy: string;
  updatedBy: string;
  submittedAt: Date | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  publishedAt: Date | null;
  publishedBy: string | null;
  archivedAt: Date | null;
  metaTitle: Record<string, string> | null;
  metaDescription: Record<string, string> | null;
  viewCount: number;
  downloadCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export class PublicationService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: StandaloneKafkaProducer,
    private readonly categoryService: CategoryService,
    private readonly searchService: SearchService,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // CRUD + Workflow
  // ─────────────────────────────────────────────────────────────

  async create(dto: CreatePublicationInput, user: AuthenticatedUser): Promise<ApiResponse<PublicationRecord>> {
    // 1. Resolve & authorize category
    const category = await (this.prisma as any).knowledgeCategory.findUnique({ where: { id: dto.categoryId } });
    if (!category) throw this.httpError(404, 'Category not found');
    if (!this.categoryService.canPublishInCategory(user, category)) {
      throw this.httpError(403, 'You are not allowed to publish in this category');
    }

    // 2. Generate slug if missing (EN title preferred, fallback to first locale)
    const slug = dto.slug ?? this.slugify(this.pickFirstLocaleValue(dto.title) ?? `pub-${Date.now()}`);

    // 3. Build content text for indexing (strip HTML tags)
    const contentText = dto.contentText ?? this.stripHtmlMultilingual(dto.contentHtml);

    // 4. Create publication + attachments in a transaction
    const publication = await (this.prisma as any).knowledgePublication.create({
      data: {
        tenantId: user.tenantId,
        categoryId: dto.categoryId,
        title: dto.title,
        summary: dto.summary ?? null,
        contentHtml: dto.contentHtml,
        contentText,
        slug,
        type: dto.type,
        status: 'DRAFT',
        visibility: dto.visibility ?? 'PUBLIC',
        dataClassification: dto.dataClassification ?? DataClassification.PUBLIC,
        authors: dto.authors ?? [],
        tags: dto.tags ?? [],
        coverImageId: dto.coverImageId ?? null,
        metaTitle: dto.metaTitle ?? null,
        metaDescription: dto.metaDescription ?? null,
        createdBy: user.userId,
        updatedBy: user.userId,
        attachments: dto.attachments && dto.attachments.length > 0 ? {
          create: dto.attachments.map((a) => ({
            fileId: a.fileId,
            caption: a.caption ?? null,
            kind: a.kind,
            sortOrder: a.sortOrder ?? 0,
          })),
        } : undefined,
      },
      include: { attachments: true, category: true },
    });

    await this.publishEvent(TOPIC_AU_KNOWLEDGE_PUBLICATION_CREATED, publication, user);
    return { data: publication };
  }

  async update(id: string, dto: UpdatePublicationInput, user: AuthenticatedUser): Promise<ApiResponse<PublicationRecord>> {
    const existing = await this.fetchAndAuthorizeWrite(id, user);

    // Authors can only edit their own DRAFT/REJECTED publications.
    // Reviewers can edit anything except already-archived content.
    const isReviewer = user.roles?.some((r) => REVIEWER_ROLES.has(r));
    if (!isReviewer) {
      if (existing.createdBy !== user.userId) throw this.httpError(403, 'Cannot edit a publication you did not create');
      if (existing.status !== 'DRAFT' && existing.status !== 'REJECTED') {
        throw this.httpError(409, `Cannot edit publication in status ${existing.status}`);
      }
    }

    if (dto.categoryId && dto.categoryId !== existing.categoryId) {
      const newCategory = await (this.prisma as any).knowledgeCategory.findUnique({ where: { id: dto.categoryId } });
      if (!newCategory) throw this.httpError(404, 'New category not found');
      if (!this.categoryService.canPublishInCategory(user, newCategory)) {
        throw this.httpError(403, 'You are not allowed to publish in the target category');
      }
    }

    // If attachments are provided, replace the set
    let attachmentsUpdate: any = undefined;
    if (dto.attachments !== undefined) {
      attachmentsUpdate = {
        deleteMany: {},
        create: dto.attachments.map((a) => ({
          fileId: a.fileId,
          caption: a.caption ?? null,
          kind: a.kind,
          sortOrder: a.sortOrder ?? 0,
        })),
      };
    }

    const contentText = dto.contentHtml
      ? (dto.contentText ?? this.stripHtmlMultilingual(dto.contentHtml))
      : undefined;

    const publication = await (this.prisma as any).knowledgePublication.update({
      where: { id },
      data: {
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.summary !== undefined && { summary: dto.summary }),
        ...(dto.contentHtml !== undefined && { contentHtml: dto.contentHtml }),
        ...(contentText !== undefined && { contentText }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.visibility !== undefined && { visibility: dto.visibility }),
        ...(dto.dataClassification !== undefined && { dataClassification: dto.dataClassification }),
        ...(dto.authors !== undefined && { authors: dto.authors }),
        ...(dto.tags !== undefined && { tags: dto.tags }),
        ...(dto.coverImageId !== undefined && { coverImageId: dto.coverImageId }),
        ...(dto.metaTitle !== undefined && { metaTitle: dto.metaTitle }),
        ...(dto.metaDescription !== undefined && { metaDescription: dto.metaDescription }),
        updatedBy: user.userId,
        ...(attachmentsUpdate && { attachments: attachmentsUpdate }),
        // Re-edit after rejection puts it back to DRAFT
        ...(existing.status === 'REJECTED' && !isReviewer && { status: 'DRAFT', rejectionReason: null }),
      },
      include: { attachments: true, category: true },
    });

    await this.publishEvent(TOPIC_AU_KNOWLEDGE_PUBLICATION_UPDATED, publication, user);
    return { data: publication };
  }

  async delete(id: string, user: AuthenticatedUser): Promise<ApiResponse<{ deleted: boolean }>> {
    const existing = await this.fetchAndAuthorizeWrite(id, user);
    const isReviewer = user.roles?.some((r) => REVIEWER_ROLES.has(r));
    if (!isReviewer && existing.createdBy !== user.userId) {
      throw this.httpError(403, 'Cannot delete a publication you did not create');
    }
    if (!isReviewer && existing.status === 'PUBLISHED') {
      throw this.httpError(403, 'Published items can only be deleted by a knowledge manager');
    }

    await (this.prisma as any).knowledgePublication.delete({ where: { id } });
    await this.publishEvent(TOPIC_AU_KNOWLEDGE_PUBLICATION_DELETED, existing as any, user);
    await this.searchService.remove(id);
    return { data: { deleted: true } };
  }

  // ─── Workflow transitions ─────────────────────────────────────

  async submit(id: string, user: AuthenticatedUser): Promise<ApiResponse<PublicationRecord>> {
    const existing = await this.fetchAndAuthorizeWrite(id, user);
    if (existing.createdBy !== user.userId && !user.roles?.some((r) => REVIEWER_ROLES.has(r))) {
      throw this.httpError(403, 'You can only submit your own publications');
    }
    if (existing.status !== 'DRAFT' && existing.status !== 'REJECTED') {
      throw this.httpError(409, `Only DRAFT or REJECTED publications can be submitted (current: ${existing.status})`);
    }

    const publication = await (this.prisma as any).knowledgePublication.update({
      where: { id },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
        rejectionReason: null,
        updatedBy: user.userId,
      },
      include: { attachments: true, category: true },
    });

    await this.publishEvent(TOPIC_AU_KNOWLEDGE_PUBLICATION_SUBMITTED, publication, user);
    return { data: publication };
  }

  async review(
    id: string,
    dto: ReviewPublicationInput,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<PublicationRecord>> {
    if (!user.roles?.some((r) => REVIEWER_ROLES.has(r))) {
      throw this.httpError(403, 'Only knowledge managers can review publications');
    }

    const existing = await (this.prisma as any).knowledgePublication.findUnique({ where: { id } });
    if (!existing) throw this.httpError(404, 'Publication not found');
    if (existing.status !== 'SUBMITTED' && existing.status !== 'UNDER_REVIEW') {
      throw this.httpError(409, `Cannot review publication in status ${existing.status}`);
    }

    const now = new Date();
    let nextStatus: PublicationStatus;
    let topic: string;

    switch (dto.decision) {
      case 'APPROVED':
        nextStatus = 'APPROVED';
        topic = TOPIC_AU_KNOWLEDGE_PUBLICATION_APPROVED;
        break;
      case 'REJECTED':
        nextStatus = 'REJECTED';
        topic = TOPIC_AU_KNOWLEDGE_PUBLICATION_REJECTED;
        break;
      case 'REQUEST_CHANGES':
        nextStatus = 'REJECTED'; // sends it back to author with comment
        topic = TOPIC_AU_KNOWLEDGE_PUBLICATION_REJECTED;
        break;
      case 'COMMENT':
        nextStatus = 'UNDER_REVIEW';
        topic = TOPIC_AU_KNOWLEDGE_PUBLICATION_UPDATED;
        break;
      default:
        throw this.httpError(400, `Unknown decision ${dto.decision}`);
    }

    // Persist decision + review trail entry in a transaction
    const publication = await (this.prisma as any).$transaction(async (tx: any) => {
      await tx.knowledgePublicationReview.create({
        data: {
          publicationId: id,
          reviewerId: user.userId,
          reviewerRole: user.role,
          decision: dto.decision,
          comment: dto.comment ?? null,
        },
      });

      return tx.knowledgePublication.update({
        where: { id },
        data: {
          status: nextStatus,
          reviewedBy: user.userId,
          reviewedAt: now,
          rejectionReason: nextStatus === 'REJECTED' ? (dto.comment ?? null) : null,
          updatedBy: user.userId,
        },
        include: { attachments: true, category: true, reviews: true },
      });
    });

    await this.publishEvent(topic, { ...publication, reviewerComment: dto.comment, authorId: existing.createdBy }, user);
    return { data: publication };
  }

  async publish(id: string, user: AuthenticatedUser): Promise<ApiResponse<PublicationRecord>> {
    if (!user.roles?.some((r) => REVIEWER_ROLES.has(r))) {
      throw this.httpError(403, 'Only knowledge managers can publish');
    }
    const existing = await (this.prisma as any).knowledgePublication.findUnique({ where: { id } });
    if (!existing) throw this.httpError(404, 'Publication not found');
    if (existing.status !== 'APPROVED') {
      throw this.httpError(409, `Only APPROVED publications can be published (current: ${existing.status})`);
    }

    const publication = await (this.prisma as any).knowledgePublication.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        publishedBy: user.userId,
        updatedBy: user.userId,
      },
      include: { attachments: true, category: true },
    });

    await this.publishEvent(TOPIC_AU_KNOWLEDGE_PUBLICATION_PUBLISHED, { ...publication, authorId: existing.createdBy }, user);
    // Index for search
    await this.searchService.index(publication);
    return { data: publication };
  }

  async archive(id: string, user: AuthenticatedUser): Promise<ApiResponse<PublicationRecord>> {
    if (!user.roles?.some((r) => REVIEWER_ROLES.has(r))) {
      throw this.httpError(403, 'Only knowledge managers can archive');
    }
    const existing = await (this.prisma as any).knowledgePublication.findUnique({ where: { id } });
    if (!existing) throw this.httpError(404, 'Publication not found');

    const publication = await (this.prisma as any).knowledgePublication.update({
      where: { id },
      data: { status: 'ARCHIVED', archivedAt: new Date(), updatedBy: user.userId },
      include: { attachments: true, category: true },
    });
    await this.publishEvent(TOPIC_AU_KNOWLEDGE_PUBLICATION_ARCHIVED, publication, user);
    await this.searchService.remove(id);
    return { data: publication };
  }

  // ─────────────────────────────────────────────────────────────
  // Read
  // ─────────────────────────────────────────────────────────────

  async findOne(id: string, user: AuthenticatedUser | null): Promise<ApiResponse<PublicationRecord>> {
    const publication = await (this.prisma as any).knowledgePublication.findUnique({
      where: { id },
      include: { attachments: { orderBy: { sortOrder: 'asc' } }, category: true, reviews: { orderBy: { createdAt: 'asc' } } },
    });
    if (!publication) throw this.httpError(404, 'Publication not found');
    this.assertReadAccess(publication, user);

    // Increment view count for public reads (best-effort, fire and forget)
    if (publication.status === 'PUBLISHED') {
      (this.prisma as any).knowledgePublication
        .update({ where: { id }, data: { viewCount: { increment: 1 } } })
        .catch(() => undefined);
    }

    return { data: publication };
  }

  async findBySlug(slug: string, user: AuthenticatedUser | null): Promise<ApiResponse<PublicationRecord>> {
    const publication = await (this.prisma as any).knowledgePublication.findUnique({
      where: { slug },
      include: { attachments: { orderBy: { sortOrder: 'asc' } }, category: true },
    });
    if (!publication) throw this.httpError(404, 'Publication not found');
    this.assertReadAccess(publication, user);
    return { data: publication };
  }

  /**
   * Aggregated counters for the public landing page (no auth required).
   * Returns headline KPIs scoped to PUBLISHED + PUBLIC content only:
   *  - publications: total publicly visible publications
   *  - categories: total active+approved categories
   *  - contributingTenants: distinct tenants that have at least one
   *      published+public publication (i.e. RECs + countries actively
   *      contributing to the knowledge base)
   *  - totalViews: cumulative view count across public publications
   */
  async publicStats(): Promise<ApiResponse<{
    publications: number;
    categories: number;
    contributingTenants: number;
    totalViews: number;
  }>> {
    const [publications, categories, distinctTenants, viewsAgg] = await Promise.all([
      (this.prisma as any).knowledgePublication.count({
        where: { status: 'PUBLISHED', visibility: 'PUBLIC' },
      }),
      (this.prisma as any).knowledgeCategory.count({
        where: { isActive: true, status: 'APPROVED' },
      }),
      (this.prisma as any).knowledgePublication.findMany({
        where: { status: 'PUBLISHED', visibility: 'PUBLIC' },
        distinct: ['tenantId'],
        select: { tenantId: true },
      }),
      (this.prisma as any).knowledgePublication.aggregate({
        where: { status: 'PUBLISHED', visibility: 'PUBLIC' },
        _sum: { viewCount: true },
      }),
    ]);

    return {
      data: {
        publications,
        categories,
        contributingTenants: distinctTenants.length,
        totalViews: viewsAgg._sum?.viewCount ?? 0,
      },
    };
  }

  async findAll(
    user: AuthenticatedUser | null,
    query: PublicationFilterInput,
  ): Promise<PaginatedResponse<PublicationRecord>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;
    const orderBy = query.sort ? { [query.sort]: query.order ?? 'desc' } : { publishedAt: 'desc' as const };

    const where: Record<string, unknown> = {};

    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.type) where.type = query.type;
    if (query.tag) where.tags = { has: query.tag };
    if (query.search) {
      // Postgres JSON search across title locales
      where.OR = [
        { tags: { has: query.search } },
        // raw text contains across JSON fields requires raw SQL — keep simple here
      ];
    }

    // ── Visibility / status scoping ────────────────────────
    if (!user) {
      // public unauthenticated access
      where.status = 'PUBLISHED';
      where.visibility = 'PUBLIC';
    } else {
      const isReviewer = user.roles?.some((r) => REVIEWER_ROLES.has(r));
      if (query.mine) {
        where.createdBy = user.userId;
      } else if (isReviewer) {
        // reviewers see everything; status filter optional
        if (query.status) where.status = query.status;
        if (query.visibility) where.visibility = query.visibility;
      } else {
        // Authors see their own drafts/rejected + all published they have visibility on
        where.OR = [
          { createdBy: user.userId },
          { status: 'PUBLISHED', visibility: { in: ['PUBLIC', 'PRIVATE'] } },
        ];
        if (query.status) where.status = query.status;
      }
    }

    const [data, total] = await Promise.all([
      (this.prisma as any).knowledgePublication.findMany({
        where, skip, take: limit, orderBy,
        include: { category: true, attachments: { orderBy: { sortOrder: 'asc' }, take: 1 } },
      }),
      (this.prisma as any).knowledgePublication.count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  /** Reviewer queue: SUBMITTED + UNDER_REVIEW only. */
  async reviewQueue(user: AuthenticatedUser): Promise<PaginatedResponse<PublicationRecord>> {
    if (!user.roles?.some((r) => REVIEWER_ROLES.has(r))) {
      throw this.httpError(403, 'Only knowledge managers can view the review queue');
    }
    const data = await (this.prisma as any).knowledgePublication.findMany({
      where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
      orderBy: { submittedAt: 'asc' },
      include: { category: true, reviews: { orderBy: { createdAt: 'desc' }, take: 3 } },
    });
    return { data, meta: { total: data.length, page: 1, limit: data.length } };
  }

  // ─────────────────────────────────────────────────────────────
  // Internals
  // ─────────────────────────────────────────────────────────────

  private async fetchAndAuthorizeWrite(id: string, user: AuthenticatedUser): Promise<PublicationRecord> {
    const existing = await (this.prisma as any).knowledgePublication.findUnique({ where: { id } });
    if (!existing) throw this.httpError(404, 'Publication not found');

    // Same-tenant check (except continental roles which can act on anything)
    if (
      user.tenantLevel !== TenantLevel.CONTINENTAL &&
      !user.roles?.some((r) => REVIEWER_ROLES.has(r)) &&
      existing.tenantId !== user.tenantId
    ) {
      throw this.httpError(404, 'Publication not found');
    }
    return existing;
  }

  private assertReadAccess(publication: PublicationRecord, user: AuthenticatedUser | null): void {
    if (publication.status === 'PUBLISHED' && publication.visibility === 'PUBLIC') return;
    if (!user) throw this.httpError(404, 'Publication not found');

    if (publication.status === 'PUBLISHED' && publication.visibility === 'PRIVATE') return; // any authenticated user
    if (publication.createdBy === user.userId) return;
    if (user.roles?.some((r) => REVIEWER_ROLES.has(r))) return;
    throw this.httpError(404, 'Publication not found');
  }

  private slugify(input: string): string {
    return input
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 200)
      || `pub-${Date.now()}`;
  }

  private pickFirstLocaleValue(obj: Record<string, string | undefined> | undefined): string | undefined {
    if (!obj) return undefined;
    return obj.en ?? obj.fr ?? obj.pt ?? obj.ar;
  }

  private stripHtmlMultilingual(content: Record<string, string>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [locale, html] of Object.entries(content)) {
      if (typeof html === 'string') {
        out[locale] = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      }
    }
    return out;
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
      console.error(`[PublicationService] Failed to publish ${topic}:`, err instanceof Error ? err.message : err);
    }
  }
}

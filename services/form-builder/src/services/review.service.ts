import type { PrismaClient, Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '@aris/auth-middleware';

class HttpError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
  }
}

export interface ReviewInput {
  templateId: string;
  message?: string;
  reviewers: Array<{
    userId: string;
    userName: string;
    userEmail: string;
    tenantId: string;
  }>;
}

export interface CommentInput {
  content: string;
  parentId?: string;
}

export class ReviewService {
  constructor(private readonly prisma: PrismaClient) {}

  async createReview(dto: ReviewInput, user: AuthenticatedUser) {
    if (!dto.reviewers || dto.reviewers.length === 0) {
      throw new HttpError(400, 'At least one reviewer is required');
    }

    const template = await (this.prisma as any).formTemplate.findUnique({
      where: { id: dto.templateId },
    });
    if (!template) throw new HttpError(404, 'Template not found');

    const review = await (this.prisma as any).formReview.create({
      data: {
        template_id: dto.templateId,
        tenant_id: user.tenantId,
        sender_id: user.userId,
        sender_name: `${(user as any).firstName || ''} ${(user as any).lastName || ''}`.trim() || user.userId,
        message: dto.message || null,
        status: 'PENDING',
      },
    });

    // Create reviewer entries
    for (const r of dto.reviewers) {
      await (this.prisma as any).formReviewUser.create({
        data: {
          review_id: review.id,
          user_id: r.userId,
          user_name: r.userName,
          user_email: r.userEmail,
          tenant_id: r.tenantId,
        },
      });
    }

    const full = await this.findOne(review.id, user);
    console.log(`[ReviewService] Review created for template ${dto.templateId} with ${dto.reviewers.length} reviewer(s)`);
    return full;
  }

  async findByTemplate(templateId: string, user: AuthenticatedUser) {
    const reviews = await (this.prisma as any).formReview.findMany({
      where: {
        template_id: templateId,
        OR: [
          { sender_id: user.userId },
          { reviewers: { some: { user_id: user.userId } } },
        ],
      },
      include: {
        reviewers: true,
        _count: { select: { comments: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    return {
      data: reviews.map((r: any) => this.toEntity(r)),
    };
  }

  async findMyReviews(user: AuthenticatedUser, query: { page?: number; limit?: number; status?: string }) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: any = {
      OR: [
        { sender_id: user.userId },
        { reviewers: { some: { user_id: user.userId } } },
      ],
    };
    if (query.status) where.status = query.status;

    const [data, total] = await Promise.all([
      (this.prisma as any).formReview.findMany({
        where,
        include: {
          reviewers: true,
          template: { select: { id: true, name: true, domain: true, status: true } },
          _count: { select: { comments: true } },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      (this.prisma as any).formReview.count({ where }),
    ]);

    return {
      data: data.map((r: any) => ({
        ...this.toEntity(r),
        template: r.template ? { id: r.template.id, name: r.template.name, domain: r.template.domain, status: r.template.status } : null,
      })),
      meta: { total, page, limit },
    };
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const review = await (this.prisma as any).formReview.findUnique({
      where: { id },
      include: {
        reviewers: true,
        comments: {
          orderBy: { created_at: 'asc' },
        },
        template: { select: { id: true, name: true, domain: true, status: true } },
        _count: { select: { comments: true } },
      },
    });
    if (!review) throw new HttpError(404, 'Review not found');

    // Mark as read if user is a reviewer
    await (this.prisma as any).formReviewUser.updateMany({
      where: { review_id: id, user_id: user.userId, has_read: false },
      data: { has_read: true, read_at: new Date() },
    });

    // Update status to IN_REVIEW if PENDING and someone opened it
    if (review.status === 'PENDING') {
      await (this.prisma as any).formReview.update({
        where: { id },
        data: { status: 'IN_REVIEW' },
      });
    }

    return {
      data: {
        ...this.toEntity(review),
        template: review.template,
        comments: review.comments.map((c: any) => this.toCommentEntity(c)),
      },
    };
  }

  async addComment(reviewId: string, dto: CommentInput, user: AuthenticatedUser) {
    const review = await (this.prisma as any).formReview.findUnique({ where: { id: reviewId } });
    if (!review) throw new HttpError(404, 'Review not found');
    if (review.status === 'CANCELLED') throw new HttpError(400, 'Cannot comment on a cancelled review');

    if (dto.parentId) {
      const parent = await (this.prisma as any).formReviewComment.findUnique({ where: { id: dto.parentId } });
      if (!parent || parent.review_id !== reviewId) throw new HttpError(400, 'Invalid parent comment');
    }

    const comment = await (this.prisma as any).formReviewComment.create({
      data: {
        review_id: reviewId,
        user_id: user.userId,
        user_name: `${(user as any).firstName || ''} ${(user as any).lastName || ''}`.trim() || user.userId,
        content: dto.content,
        parent_id: dto.parentId || null,
      },
    });

    return { data: this.toCommentEntity(comment) };
  }

  async updateSynthesis(reviewId: string, synthesis: string, user: AuthenticatedUser) {
    const review = await (this.prisma as any).formReview.findUnique({ where: { id: reviewId } });
    if (!review) throw new HttpError(404, 'Review not found');
    if (review.sender_id !== user.userId) throw new HttpError(403, 'Only the sender can update the synthesis');

    const updated = await (this.prisma as any).formReview.update({
      where: { id: reviewId },
      data: { synthesis, status: 'COMPLETED', closed_at: new Date() },
    });

    return { data: this.toEntity(updated) };
  }

  async closeReview(reviewId: string, user: AuthenticatedUser) {
    const review = await (this.prisma as any).formReview.findUnique({ where: { id: reviewId } });
    if (!review) throw new HttpError(404, 'Review not found');
    if (review.sender_id !== user.userId) throw new HttpError(403, 'Only the sender can close the review');

    const updated = await (this.prisma as any).formReview.update({
      where: { id: reviewId },
      data: { status: 'COMPLETED', closed_at: new Date() },
    });

    return { data: this.toEntity(updated) };
  }

  private toEntity(row: any) {
    return {
      id: row.id,
      templateId: row.template_id,
      tenantId: row.tenant_id,
      senderId: row.sender_id,
      senderName: row.sender_name,
      message: row.message,
      status: row.status,
      synthesis: row.synthesis,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      closedAt: row.closed_at,
      commentCount: row._count?.comments ?? 0,
      reviewers: (row.reviewers ?? []).map((r: any) => ({
        id: r.id,
        userId: r.user_id,
        userName: r.user_name,
        userEmail: r.user_email,
        tenantId: r.tenant_id,
        hasRead: r.has_read,
        readAt: r.read_at,
      })),
    };
  }

  private toCommentEntity(row: any) {
    return {
      id: row.id,
      reviewId: row.review_id,
      userId: row.user_id,
      userName: row.user_name,
      content: row.content,
      parentId: row.parent_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

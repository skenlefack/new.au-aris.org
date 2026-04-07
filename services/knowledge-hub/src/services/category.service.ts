import { v4 as uuidv4 } from 'uuid';
import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import {
  TenantLevel,
  UserRole,
  TOPIC_AU_KNOWLEDGE_CATEGORY_CREATED,
  TOPIC_AU_KNOWLEDGE_CATEGORY_UPDATED,
  TOPIC_AU_KNOWLEDGE_CATEGORY_DELETED,
} from '@aris/shared-types';
import type { KafkaHeaders, ApiResponse } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
  CategoryFilterInput,
} from '../schemas/knowledge.schema';

const SERVICE_NAME = 'knowledge-hub-service';

const CATEGORY_MANAGER_ROLES = new Set<string>([
  UserRole.SUPER_ADMIN,
  UserRole.CONTINENTAL_ADMIN,
  UserRole.KNOWLEDGE_MANAGER,
]);

interface CategoryNode {
  id: string;
  parentId: string | null;
  slug: string;
  nameEn: string;
  nameFr: string | null;
  namePt: string | null;
  nameAr: string | null;
  scope: string;
  scopeTenantId: string | null;
  recParentTenantId: string | null;
  icon: string | null;
  color: string | null;
  sortOrder: number;
  isSystem: boolean;
  isActive: boolean;
  children?: CategoryNode[];
  publicationCount?: number;
}

export class CategoryService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: StandaloneKafkaProducer,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // Public helpers (used by PublicationService)
  // ─────────────────────────────────────────────────────────────

  /**
   * Returns true if the given user is allowed to publish in the given category.
   *
   * Rules:
   *  - CONTINENTAL_ADMIN / SUPER_ADMIN / KNOWLEDGE_MANAGER → any category
   *  - REC_ADMIN (tenantLevel REC) →
   *      • category.scope = REC AND category.scopeTenantId = user.tenantId, OR
   *      • category.scope = COUNTRY AND category.recParentTenantId = user.tenantId
   *  - NATIONAL roles (tenantLevel MEMBER_STATE) →
   *      • category.scope = COUNTRY AND category.scopeTenantId = user.tenantId
   *      (NOT allowed at REC or CONTINENTAL level — confirmed by product owner)
   */
  canPublishInCategory(
    user: AuthenticatedUser,
    category: { scope: string; scopeTenantId: string | null; recParentTenantId: string | null; isActive: boolean },
  ): boolean {
    if (!category.isActive) return false;

    // Continental override
    if (
      user.tenantLevel === TenantLevel.CONTINENTAL ||
      user.roles?.some((r) => CATEGORY_MANAGER_ROLES.has(r))
    ) {
      return true;
    }

    if (user.tenantLevel === TenantLevel.REC) {
      if (category.scope === 'REC' && category.scopeTenantId === user.tenantId) return true;
      if (category.scope === 'COUNTRY' && category.recParentTenantId === user.tenantId) return true;
      return false;
    }

    if (user.tenantLevel === TenantLevel.MEMBER_STATE) {
      if (category.scope === 'COUNTRY' && category.scopeTenantId === user.tenantId) return true;
      return false;
    }

    return false;
  }

  /**
   * Returns true if the user is allowed to view the given category.
   * View rules are looser than publish rules: anyone authenticated can browse
   * categories at or above their scope (e.g. a Kenya user sees CONTINENTAL +
   * IGAD + Kenya categories). Public unauthenticated visitors see all PUBLIC
   * publications regardless of category scope.
   */
  canViewCategory(
    user: AuthenticatedUser | null,
    category: { scope: string; scopeTenantId: string | null; recParentTenantId: string | null; isActive: boolean },
  ): boolean {
    if (!category.isActive) return false;
    if (!user) return true; // public listing — visibility filtering happens on publications
    if (user.tenantLevel === TenantLevel.CONTINENTAL) return true;

    if (user.tenantLevel === TenantLevel.REC) {
      if (category.scope === 'CONTINENTAL') return true;
      if (category.scope === 'REC' && category.scopeTenantId === user.tenantId) return true;
      if (category.scope === 'COUNTRY' && category.recParentTenantId === user.tenantId) return true;
      return false;
    }

    if (user.tenantLevel === TenantLevel.MEMBER_STATE) {
      if (category.scope === 'CONTINENTAL') return true;
      if (category.scope === 'REC' && category.scopeTenantId) {
        // Country user can also view its parent REC categories — we don't know
        // the REC id directly, but we can check via any of the user's COUNTRY
        // categories' recParentTenantId. For simplicity, allow REC viewing
        // (no sensitive data — visibility on publications still applies).
        return true;
      }
      if (category.scope === 'COUNTRY' && category.scopeTenantId === user.tenantId) return true;
      return false;
    }

    return true;
  }

  // ─────────────────────────────────────────────────────────────
  // CRUD
  // ─────────────────────────────────────────────────────────────

  async create(dto: CreateCategoryInput, user: AuthenticatedUser): Promise<ApiResponse<CategoryNode>> {
    this.assertManager(user);

    // Validate scope/tenant pairing
    if (dto.scope === 'CONTINENTAL' && dto.scopeTenantId) {
      throw this.httpError(400, 'CONTINENTAL categories must not have a scopeTenantId');
    }
    if ((dto.scope === 'REC' || dto.scope === 'COUNTRY') && !dto.scopeTenantId) {
      throw this.httpError(400, `${dto.scope} categories require a scopeTenantId`);
    }
    if (dto.scope === 'COUNTRY' && !dto.recParentTenantId) {
      throw this.httpError(400, 'COUNTRY categories require a recParentTenantId');
    }

    // Slug uniqueness check
    const slugExists = await (this.prisma as any).knowledgeCategory.findUnique({ where: { slug: dto.slug } });
    if (slugExists) throw this.httpError(409, `Category slug "${dto.slug}" already exists`);

    const category = await (this.prisma as any).knowledgeCategory.create({
      data: {
        parentId: dto.parentId ?? null,
        slug: dto.slug,
        nameEn: dto.nameEn,
        nameFr: dto.nameFr ?? null,
        namePt: dto.namePt ?? null,
        nameAr: dto.nameAr ?? null,
        descriptionEn: dto.descriptionEn ?? null,
        descriptionFr: dto.descriptionFr ?? null,
        descriptionPt: dto.descriptionPt ?? null,
        descriptionAr: dto.descriptionAr ?? null,
        scope: dto.scope,
        scopeTenantId: dto.scopeTenantId ?? null,
        recParentTenantId: dto.recParentTenantId ?? null,
        icon: dto.icon ?? null,
        color: dto.color ?? null,
        sortOrder: dto.sortOrder ?? 0,
        isSystem: false,
        createdBy: user.userId,
      },
    });

    await this.publishEvent(TOPIC_AU_KNOWLEDGE_CATEGORY_CREATED, category, user);
    return { data: category };
  }

  async update(id: string, dto: UpdateCategoryInput, user: AuthenticatedUser): Promise<ApiResponse<CategoryNode>> {
    this.assertManager(user);

    const existing = await (this.prisma as any).knowledgeCategory.findUnique({ where: { id } });
    if (!existing) throw this.httpError(404, 'Category not found');
    if (existing.isSystem && dto.parentId !== undefined) {
      throw this.httpError(400, 'System categories cannot be re-parented');
    }

    const category = await (this.prisma as any).knowledgeCategory.update({
      where: { id },
      data: {
        ...(dto.parentId !== undefined && { parentId: dto.parentId }),
        ...(dto.nameEn !== undefined && { nameEn: dto.nameEn }),
        ...(dto.nameFr !== undefined && { nameFr: dto.nameFr }),
        ...(dto.namePt !== undefined && { namePt: dto.namePt }),
        ...(dto.nameAr !== undefined && { nameAr: dto.nameAr }),
        ...(dto.descriptionEn !== undefined && { descriptionEn: dto.descriptionEn }),
        ...(dto.descriptionFr !== undefined && { descriptionFr: dto.descriptionFr }),
        ...(dto.descriptionPt !== undefined && { descriptionPt: dto.descriptionPt }),
        ...(dto.descriptionAr !== undefined && { descriptionAr: dto.descriptionAr }),
        ...(dto.icon !== undefined && { icon: dto.icon }),
        ...(dto.color !== undefined && { color: dto.color }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    await this.publishEvent(TOPIC_AU_KNOWLEDGE_CATEGORY_UPDATED, category, user);
    return { data: category };
  }

  async delete(id: string, user: AuthenticatedUser): Promise<ApiResponse<{ deleted: boolean }>> {
    this.assertManager(user);

    const existing = await (this.prisma as any).knowledgeCategory.findUnique({ where: { id } });
    if (!existing) throw this.httpError(404, 'Category not found');
    if (existing.isSystem) throw this.httpError(400, 'System categories cannot be deleted');

    // Reject if there are publications still attached
    const pubCount = await (this.prisma as any).knowledgePublication.count({ where: { categoryId: id } });
    if (pubCount > 0) {
      throw this.httpError(409, `Category has ${pubCount} publication(s) and cannot be deleted`);
    }

    // Reject if there are children
    const childCount = await (this.prisma as any).knowledgeCategory.count({ where: { parentId: id } });
    if (childCount > 0) throw this.httpError(409, 'Category has child categories and cannot be deleted');

    await (this.prisma as any).knowledgeCategory.delete({ where: { id } });
    await this.publishEvent(TOPIC_AU_KNOWLEDGE_CATEGORY_DELETED, existing, user);
    return { data: { deleted: true } };
  }

  async findById(id: string, user: AuthenticatedUser | null): Promise<ApiResponse<CategoryNode>> {
    const category = await (this.prisma as any).knowledgeCategory.findUnique({ where: { id } });
    if (!category) throw this.httpError(404, 'Category not found');
    if (!this.canViewCategory(user, category)) throw this.httpError(404, 'Category not found');
    return { data: category };
  }

  async findBySlug(slug: string, user: AuthenticatedUser | null): Promise<ApiResponse<CategoryNode>> {
    const category = await (this.prisma as any).knowledgeCategory.findUnique({ where: { slug } });
    if (!category) throw this.httpError(404, 'Category not found');
    if (!this.canViewCategory(user, category)) throw this.httpError(404, 'Category not found');
    return { data: category };
  }

  /**
   * List categories the user can VIEW. Optionally filtered.
   * Returns flat list ordered by (scope, parentId, sortOrder).
   */
  async list(filters: CategoryFilterInput, user: AuthenticatedUser | null): Promise<ApiResponse<CategoryNode[]>> {
    const where: Record<string, unknown> = { isActive: true };

    if (filters.scope) where.scope = filters.scope;
    if (filters.scopeTenantId) where.scopeTenantId = filters.scopeTenantId;
    if (filters.parentId !== undefined) where.parentId = filters.parentId;
    if (filters.search) {
      where.OR = [
        { nameEn: { contains: filters.search, mode: 'insensitive' } },
        { nameFr: { contains: filters.search, mode: 'insensitive' } },
        { slug: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    // Visibility scoping for non-continental users (when authenticated)
    if (user && user.tenantLevel === TenantLevel.MEMBER_STATE) {
      where.OR = [
        { scope: 'CONTINENTAL' },
        { scope: 'REC' },
        { scope: 'COUNTRY', scopeTenantId: user.tenantId },
      ];
    } else if (user && user.tenantLevel === TenantLevel.REC) {
      where.OR = [
        { scope: 'CONTINENTAL' },
        { scope: 'REC', scopeTenantId: user.tenantId },
        { scope: 'COUNTRY', recParentTenantId: user.tenantId },
      ];
    }

    const data = await (this.prisma as any).knowledgeCategory.findMany({
      where,
      orderBy: [{ scope: 'asc' }, { sortOrder: 'asc' }, { nameEn: 'asc' }],
    });

    return { data };
  }

  /**
   * Hierarchical tree of categories the user can VIEW. Builds parent → children
   * structure from a flat list. Optional `withCounts=true` adds publicationCount.
   */
  async tree(
    filters: CategoryFilterInput & { withCounts?: boolean },
    user: AuthenticatedUser | null,
  ): Promise<ApiResponse<CategoryNode[]>> {
    const flat = (await this.list(filters, user)).data;

    let counts: Record<string, number> = {};
    if (filters.withCounts) {
      const grouped = await (this.prisma as any).knowledgePublication.groupBy({
        by: ['categoryId'],
        where: { status: 'PUBLISHED' },
        _count: { _all: true },
      });
      counts = Object.fromEntries(grouped.map((g: any) => [g.categoryId, g._count._all]));
    }

    const map = new Map<string, CategoryNode>();
    flat.forEach((c) => map.set(c.id, { ...c, children: [], publicationCount: counts[c.id] ?? 0 }));

    const roots: CategoryNode[] = [];
    map.forEach((node) => {
      if (node.parentId && map.has(node.parentId)) {
        map.get(node.parentId)!.children!.push(node);
      } else {
        roots.push(node);
      }
    });

    return { data: roots };
  }

  /**
   * List the categories the given user is *allowed to publish in*. Used by the
   * frontend to populate the category picker on the create-publication form.
   */
  async listPublishable(user: AuthenticatedUser): Promise<ApiResponse<CategoryNode[]>> {
    const where: Record<string, unknown> = { isActive: true };

    if (
      user.tenantLevel === TenantLevel.CONTINENTAL ||
      user.roles?.some((r) => CATEGORY_MANAGER_ROLES.has(r))
    ) {
      // no extra filter
    } else if (user.tenantLevel === TenantLevel.REC) {
      where.OR = [
        { scope: 'REC', scopeTenantId: user.tenantId },
        { scope: 'COUNTRY', recParentTenantId: user.tenantId },
      ];
    } else if (user.tenantLevel === TenantLevel.MEMBER_STATE) {
      where.scope = 'COUNTRY';
      where.scopeTenantId = user.tenantId;
    } else {
      return { data: [] };
    }

    const data = await (this.prisma as any).knowledgeCategory.findMany({
      where,
      orderBy: [{ scope: 'asc' }, { sortOrder: 'asc' }, { nameEn: 'asc' }],
    });
    return { data };
  }

  // ─────────────────────────────────────────────────────────────
  // Internals
  // ─────────────────────────────────────────────────────────────

  private assertManager(user: AuthenticatedUser): void {
    const allowed = user.roles?.some((r) => CATEGORY_MANAGER_ROLES.has(r));
    if (!allowed) throw this.httpError(403, 'Only continental knowledge managers can manage categories');
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
      console.error(`[CategoryService] Failed to publish ${topic}:`, err instanceof Error ? err.message : err);
    }
  }
}

import type { PrismaClient } from '@prisma/client';
import {
  TenantLevel,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from '@aris/shared-types';
import type {
  PaginatedResponse,
  ApiResponse,
} from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import type { ValidationChainEntity } from '../entities/workflow.entity.js';
import type {
  CreateChainInput,
  UpdateChainInput,
  ChainListQueryInput,
} from '../schemas/validation-chain.schemas.js';
import { HttpError } from './workflow.service.js';

export class ValidationChainService {
  constructor(private readonly prisma: PrismaClient) {}

  // ── Create ──

  async create(
    dto: CreateChainInput,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<ValidationChainEntity>> {
    const row = await (this.prisma as any).validationChain.create({
      data: {
        tenant_id: user.tenantId,
        user_id: dto.userId,
        validator_id: dto.validatorId,
        backup_validator_id: dto.backupValidatorId ?? null,
        level_type: dto.levelType,
        priority: dto.priority ?? 1,
        created_by: user.userId,
      },
    });

    const entity = await this.enrichWithUsers(this.toEntity(row));
    return { data: entity };
  }

  // ── List ──

  async findAll(
    user: AuthenticatedUser,
    query: ChainListQueryInput,
  ): Promise<PaginatedResponse<ValidationChainEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'asc' }
      : { created_at: 'desc' as const };

    const where: Record<string, unknown> = {
      ...this.buildTenantFilter(user),
      ...(query.userId && { user_id: query.userId }),
      ...(query.validatorId && { validator_id: query.validatorId }),
    };

    const [data, total] = await Promise.all([
      (this.prisma as any).validationChain.findMany({ where, skip, take: limit, orderBy }),
      (this.prisma as any).validationChain.count({ where }),
    ]);

    const entities = data.map((r: any) => this.toEntity(r));
    const enriched = await this.enrichManyWithUsers(entities);

    return {
      data: enriched,
      meta: { total, page, limit },
    };
  }

  // ── By user ──

  async findByUser(
    userId: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<ValidationChainEntity[]>> {
    const where: Record<string, unknown> = {
      user_id: userId,
      ...this.buildTenantFilter(user),
    };

    const data = await (this.prisma as any).validationChain.findMany({
      where,
      orderBy: { priority: 'asc' },
    });

    const entities = data.map((r: any) => this.toEntity(r));
    const enriched = await this.enrichManyWithUsers(entities);

    return { data: enriched };
  }

  // ── By validator ──

  async findByValidator(
    validatorId: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<ValidationChainEntity[]>> {
    const where: Record<string, unknown> = {
      validator_id: validatorId,
      ...this.buildTenantFilter(user),
    };

    const data = await (this.prisma as any).validationChain.findMany({
      where,
      orderBy: { priority: 'asc' },
    });

    const entities = data.map((r: any) => this.toEntity(r));
    const enriched = await this.enrichManyWithUsers(entities);

    return { data: enriched };
  }

  // ── Update ──

  async update(
    id: string,
    dto: UpdateChainInput,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<ValidationChainEntity>> {
    const existing = await (this.prisma as any).validationChain.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new HttpError(404, `Validation chain ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenant_id);

    const data: Record<string, unknown> = {};
    if (dto.validatorId !== undefined) data.validator_id = dto.validatorId;
    if (dto.backupValidatorId !== undefined) data.backup_validator_id = dto.backupValidatorId;
    if (dto.levelType !== undefined) data.level_type = dto.levelType;
    if (dto.priority !== undefined) data.priority = dto.priority;

    const row = await (this.prisma as any).validationChain.update({
      where: { id },
      data,
    });

    const entity = await this.enrichWithUsers(this.toEntity(row));
    return { data: entity };
  }

  // ── Delete ──

  async delete(
    id: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    const existing = await (this.prisma as any).validationChain.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new HttpError(404, `Validation chain ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenant_id);

    await (this.prisma as any).validationChain.delete({ where: { id } });
  }

  // ── User info enrichment ──

  /**
   * Enrich a single chain entity with user display info.
   * Uses raw SQL to cross-schema join (users table is in public schema).
   */
  private async enrichWithUsers(entity: ValidationChainEntity): Promise<ValidationChainEntity> {
    const userIds = [entity.userId, entity.validatorId];
    if (entity.backupValidatorId) userIds.push(entity.backupValidatorId);

    try {
      const users: any[] = await (this.prisma as any).$queryRawUnsafe(
        `SELECT id, first_name || ' ' || last_name AS display_name, email, role FROM public.users WHERE id = ANY($1::uuid[])`,
        userIds,
      );

      const userMap = new Map(users.map((u: any) => [u.id, { displayName: u.display_name, email: u.email, role: u.role }]));

      entity.user = userMap.get(entity.userId);
      entity.validator = userMap.get(entity.validatorId);
      if (entity.backupValidatorId) {
        entity.backupValidator = userMap.get(entity.backupValidatorId);
      }
    } catch {
      // Cross-schema query failed — return without user info
    }

    return entity;
  }

  private async enrichManyWithUsers(entities: ValidationChainEntity[]): Promise<ValidationChainEntity[]> {
    if (entities.length === 0) return entities;

    const allIds = new Set<string>();
    for (const e of entities) {
      allIds.add(e.userId);
      allIds.add(e.validatorId);
      if (e.backupValidatorId) allIds.add(e.backupValidatorId);
    }

    try {
      const users: any[] = await (this.prisma as any).$queryRawUnsafe(
        `SELECT id, first_name || ' ' || last_name AS display_name, email, role FROM public.users WHERE id = ANY($1::uuid[])`,
        [...allIds],
      );

      const userMap = new Map(users.map((u: any) => [u.id, { displayName: u.display_name, email: u.email, role: u.role }]));

      for (const e of entities) {
        e.user = userMap.get(e.userId);
        e.validator = userMap.get(e.validatorId);
        if (e.backupValidatorId) {
          e.backupValidator = userMap.get(e.backupValidatorId);
        }
      }
    } catch {
      // Cross-schema query failed — return without user info
    }

    return entities;
  }

  // ── Potential Validators ──

  /**
   * Find potential validators for a user.
   * Priority:
   *  1. Configured validation chains (validator + backup) — always shown first
   *  2. Fallback: users at higher roles in same tenant hierarchy
   */
  async findPotentialValidators(
    user: AuthenticatedUser,
  ): Promise<ApiResponse<Array<{ id: string; displayName: string; email: string; role: string }>>> {
    try {
      // ── Step 1: Check configured validation chains for this user ──
      const chains = await (this.prisma as any).validationChain.findMany({
        where: { user_id: user.userId },
        orderBy: { priority: 'asc' },
      });

      const chainValidatorIds = new Set<string>();
      for (const chain of chains) {
        chainValidatorIds.add(chain.validator_id);
        if (chain.backup_validator_id) chainValidatorIds.add(chain.backup_validator_id);
      }

      const configuredValidators: any[] = [];
      if (chainValidatorIds.size > 0) {
        const chainUsers: any[] = await (this.prisma as any).$queryRawUnsafe(
          `SELECT u.id, u.first_name || ' ' || u.last_name AS display_name, u.email, u.role,
                  t.level AS tenant_level, t.name AS tenant_name
           FROM public.users u
           JOIN public.tenants t ON t.id = u.tenant_id
           WHERE u.id = ANY($1::uuid[])
             AND u.is_active = true
           ORDER BY u.first_name, u.last_name`,
          [...chainValidatorIds],
        );
        configuredValidators.push(...chainUsers);
      }

      // If we have configured validators, return them first + other potential validators
      // If no chains configured, return generic higher-role users

      // ── Step 2: Fallback — higher-role users in tenant hierarchy ──
      const ROLE_HIERARCHY: Record<string, string[]> = {
        FIELD_AGENT: ['DATA_STEWARD', 'NATIONAL_ADMIN', 'WAHIS_FOCAL_POINT', 'REC_ADMIN', 'CONTINENTAL_ADMIN', 'SUPER_ADMIN'],
        DATA_STEWARD: ['NATIONAL_ADMIN', 'WAHIS_FOCAL_POINT', 'REC_ADMIN', 'CONTINENTAL_ADMIN', 'SUPER_ADMIN'],
        WAHIS_FOCAL_POINT: ['NATIONAL_ADMIN', 'REC_ADMIN', 'CONTINENTAL_ADMIN', 'SUPER_ADMIN'],
        NATIONAL_ADMIN: ['REC_ADMIN', 'CONTINENTAL_ADMIN', 'SUPER_ADMIN'],
        REC_ADMIN: ['CONTINENTAL_ADMIN', 'SUPER_ADMIN'],
        CONTINENTAL_ADMIN: ['SUPER_ADMIN'],
        ANALYST: ['DATA_STEWARD', 'NATIONAL_ADMIN', 'REC_ADMIN', 'CONTINENTAL_ADMIN', 'SUPER_ADMIN'],
        SUPER_ADMIN: [],
      };

      const higherRoles = ROLE_HIERARCHY[user.role] ?? [];
      let fallbackUsers: any[] = [];

      if (higherRoles.length > 0) {
        const rolesLiteral = `{${higherRoles.join(',')}}`;
        const excludeIds = [...chainValidatorIds, user.userId];

        fallbackUsers = await (this.prisma as any).$queryRawUnsafe(
          `SELECT u.id, u.first_name || ' ' || u.last_name AS display_name, u.email, u.role,
                  t.level AS tenant_level, t.name AS tenant_name
           FROM public.users u
           JOIN public.tenants t ON t.id = u.tenant_id
           WHERE (
             u.tenant_id = $1::uuid
             OR t.id = (SELECT parent_id FROM public.tenants WHERE id = $1::uuid)
           )
             AND u.role::text = ANY($2::text[])
             AND u.id != ALL($3::uuid[])
             AND u.is_active = true
           ORDER BY
             CASE t.level
               WHEN 'MEMBER_STATE' THEN 1
               WHEN 'REC' THEN 2
               WHEN 'CONTINENTAL' THEN 3
               ELSE 4
             END,
             u.role, u.first_name, u.last_name
           LIMIT 30`,
          user.tenantId,
          rolesLiteral,
          excludeIds,
        );
      }

      // Merge: configured validators first, then fallback (deduplicated)
      const seenIds = new Set<string>();
      const result: any[] = [];

      for (const u of configuredValidators) {
        if (!seenIds.has(u.id)) {
          seenIds.add(u.id);
          result.push({
            id: u.id,
            displayName: u.display_name,
            email: u.email,
            role: u.role,
            tenantLevel: u.tenant_level,
            tenantName: u.tenant_name,
            isConfigured: true,
          });
        }
      }

      for (const u of fallbackUsers) {
        if (!seenIds.has(u.id)) {
          seenIds.add(u.id);
          result.push({
            id: u.id,
            displayName: u.display_name,
            email: u.email,
            role: u.role,
            tenantLevel: u.tenant_level,
            tenantName: u.tenant_name,
          });
        }
      }

      return { data: result };
    } catch (err) {
      console.error('[ValidationChainService] findPotentialValidators error:', err);
      return { data: [] };
    }
  }

  // ── Tenant Filtering ──

  private buildTenantFilter(user: AuthenticatedUser): Record<string, unknown> {
    switch (user.tenantLevel) {
      case TenantLevel.CONTINENTAL:
        return {};
      case TenantLevel.REC:
        return { OR: [{ tenant_id: user.tenantId }] };
      case TenantLevel.MEMBER_STATE:
        return { tenant_id: user.tenantId };
      default:
        return { tenant_id: user.tenantId };
    }
  }

  private verifyTenantAccess(user: AuthenticatedUser, tenantId: string): void {
    if (user.tenantLevel === TenantLevel.CONTINENTAL) return;
    if (tenantId === user.tenantId) return;
    throw new HttpError(404, 'Validation chain not found');
  }

  // ── Mapping ──

  private toEntity(row: any): ValidationChainEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      validatorId: row.validator_id,
      backupValidatorId: row.backup_validator_id,
      levelType: row.level_type,
      priority: row.priority,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

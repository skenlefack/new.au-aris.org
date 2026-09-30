import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import type { AuthenticatedUser } from '@aris/auth-middleware';

export class HttpError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}

// Score matrix: likelihood × impact → 1-16
const LIKELIHOOD_SCORE: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, VERY_HIGH: 4 };
const IMPACT_SCORE: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

function computeRiskScore(likelihood: string, impact: string): number {
  return (LIKELIHOOD_SCORE[likelihood] ?? 1) * (IMPACT_SCORE[impact] ?? 1);
}

export class RiskService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly _kafka: StandaloneKafkaProducer,
  ) {}

  async create(programmeId: string, dto: any, user: AuthenticatedUser) {
    const programme = await (this.prisma as any).programme.findUnique({ where: { id: programmeId } });
    if (!programme) throw new HttpError(404, `Programme ${programmeId} not found`);

    const risk = await (this.prisma as any).programmeRisk.create({
      data: {
        programmeId,
        code: dto.code,
        description: dto.description,
        category: dto.category,
        likelihood: dto.likelihood,
        impact: dto.impact,
        riskScore: computeRiskScore(dto.likelihood, dto.impact),
        mitigation: dto.mitigation ?? null,
        ownerUserId: dto.ownerUserId ?? null,
        status: 'OPEN',
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });

    return { data: risk };
  }

  async findAll(programmeId: string) {
    const data = await (this.prisma as any).programmeRisk.findMany({
      where: { programmeId },
      orderBy: { riskScore: 'desc' },
    });
    return { data };
  }

  async update(id: string, dto: any, user: AuthenticatedUser) {
    const existing = await (this.prisma as any).programmeRisk.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, `Risk ${id} not found`);

    const updateData: Record<string, unknown> = { updatedBy: user.userId };
    if (dto.code !== undefined) updateData['code'] = dto.code;
    if (dto.description !== undefined) updateData['description'] = dto.description;
    if (dto.category !== undefined) updateData['category'] = dto.category;
    if (dto.mitigation !== undefined) updateData['mitigation'] = dto.mitigation;
    if (dto.ownerUserId !== undefined) updateData['ownerUserId'] = dto.ownerUserId;
    if (dto.status !== undefined) updateData['status'] = dto.status;
    if (dto.lastReviewDate !== undefined) updateData['lastReviewDate'] = new Date(dto.lastReviewDate);

    // Recalculate score if likelihood or impact changed
    const newLikelihood = dto.likelihood ?? existing.likelihood;
    const newImpact = dto.impact ?? existing.impact;
    if (dto.likelihood !== undefined || dto.impact !== undefined) {
      updateData['likelihood'] = newLikelihood;
      updateData['impact'] = newImpact;
      updateData['riskScore'] = computeRiskScore(newLikelihood, newImpact);
    }

    const updated = await (this.prisma as any).programmeRisk.update({ where: { id }, data: updateData });
    return { data: updated };
  }

  // ── Team Members ──

  async addTeamMember(programmeId: string, dto: any, _user: AuthenticatedUser) {
    const programme = await (this.prisma as any).programme.findUnique({ where: { id: programmeId } });
    if (!programme) throw new HttpError(404, `Programme ${programmeId} not found`);

    const existing = await (this.prisma as any).programmeTeam.findFirst({
      where: { programmeId, userId: dto.userId },
    });
    if (existing) throw new HttpError(409, 'User is already a team member');

    const member = await (this.prisma as any).programmeTeam.create({
      data: {
        programmeId,
        userId: dto.userId,
        role: dto.role,
        geoEntityId: dto.geoEntityId ?? null,
      },
    });

    return { data: member };
  }

  async findTeam(programmeId: string) {
    const data = await (this.prisma as any).programmeTeam.findMany({
      where: { programmeId },
      orderBy: { role: 'asc' },
    });
    return { data };
  }

  async removeTeamMember(programmeId: string, userId: string) {
    const member = await (this.prisma as any).programmeTeam.findFirst({
      where: { programmeId, userId },
    });
    if (!member) throw new HttpError(404, 'Team member not found');

    await (this.prisma as any).programmeTeam.delete({ where: { id: member.id } });
    return { data: { deleted: true } };
  }

  /**
   * Risk matrix summary: grouped by likelihood × impact
   */
  async riskMatrix(programmeId: string) {
    const risks = await (this.prisma as any).programmeRisk.findMany({
      where: { programmeId, status: { in: ['OPEN', 'MATERIALIZED'] } },
    });

    const matrix: Record<string, any[]> = {};
    for (const risk of risks) {
      const key = `${risk.likelihood}-${risk.impact}`;
      if (!matrix[key]) matrix[key] = [];
      matrix[key].push({ id: risk.id, code: risk.code, description: risk.description, category: risk.category });
    }

    return { data: { matrix, totalOpen: risks.length } };
  }
}

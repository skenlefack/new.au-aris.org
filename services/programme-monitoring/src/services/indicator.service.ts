import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import { DEFAULT_PAGE, DEFAULT_LIMIT, MAX_LIMIT } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

export class HttpError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}

export class IndicatorService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly _kafka: StandaloneKafkaProducer,
  ) {}

  async create(dto: any, _user: AuthenticatedUser) {
    const indicator = await (this.prisma as any).outputIndicator.create({
      data: {
        outputId: dto.outputId,
        code: dto.code,
        name: dto.name,
        unit: dto.unit,
        direction: dto.direction ?? 'INCREASE',
        baselineValue: dto.baselineValue ?? null,
        baselineDate: dto.baselineDate ? new Date(dto.baselineDate) : null,
        targetValue: dto.targetValue,
        dataSource: dto.dataSource ?? null,
        collectionMethod: dto.collectionMethod ?? 'MANUAL',
        disaggregationBy: dto.disaggregationBy ?? [],
      },
    });
    return { data: indicator };
  }

  async findAll(
    _user: AuthenticatedUser,
    query: { page?: number; limit?: number },
    filter: { outputId?: string; programmeId?: string },
  ) {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (filter.outputId) where['outputId'] = filter.outputId;
    if (filter.programmeId) {
      where['output'] = { component: { programmeId: filter.programmeId } };
    }

    const [data, total] = await Promise.all([
      (this.prisma as any).outputIndicator.findMany({
        where,
        skip,
        take: limit,
        include: { values: { orderBy: { period: 'desc' } }, output: { select: { id: true, code: true, name: true } } },
      }),
      (this.prisma as any).outputIndicator.count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  async findOne(id: string) {
    const indicator = await (this.prisma as any).outputIndicator.findUnique({
      where: { id },
      include: { values: { orderBy: { period: 'asc' } }, output: { select: { id: true, code: true, name: true } } },
    });
    if (!indicator) throw new HttpError(404, `Indicator ${id} not found`);
    return { data: indicator };
  }

  async update(id: string, dto: any) {
    const existing = await (this.prisma as any).outputIndicator.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, `Indicator ${id} not found`);

    const updateData: Record<string, unknown> = {};
    if (dto.code !== undefined) updateData['code'] = dto.code;
    if (dto.name !== undefined) updateData['name'] = dto.name;
    if (dto.unit !== undefined) updateData['unit'] = dto.unit;
    if (dto.direction !== undefined) updateData['direction'] = dto.direction;
    if (dto.baselineValue !== undefined) updateData['baselineValue'] = dto.baselineValue;
    if (dto.baselineDate !== undefined) updateData['baselineDate'] = new Date(dto.baselineDate);
    if (dto.targetValue !== undefined) updateData['targetValue'] = dto.targetValue;
    if (dto.dataSource !== undefined) updateData['dataSource'] = dto.dataSource;
    if (dto.collectionMethod !== undefined) updateData['collectionMethod'] = dto.collectionMethod;
    if (dto.disaggregationBy !== undefined) updateData['disaggregationBy'] = dto.disaggregationBy;

    const updated = await (this.prisma as any).outputIndicator.update({ where: { id }, data: updateData });
    return { data: updated };
  }

  // ── Indicator Values ──

  async addValue(indicatorId: string, dto: any, user: AuthenticatedUser) {
    const indicator = await (this.prisma as any).outputIndicator.findUnique({ where: { id: indicatorId } });
    if (!indicator) throw new HttpError(404, `Indicator ${indicatorId} not found`);

    const value = await (this.prisma as any).pmIndicatorValue.create({
      data: {
        indicatorId,
        period: dto.period,
        actualValue: dto.actualValue,
        status: 'DRAFT',
        evidenceUrl: dto.evidenceUrl ?? null,
        reportedBy: user.userId,
        disaggregation: dto.disaggregation ?? null,
        comment: dto.comment ?? null,
      },
    });

    return { data: value };
  }

  async getValues(indicatorId: string) {
    const data = await (this.prisma as any).pmIndicatorValue.findMany({
      where: { indicatorId },
      orderBy: { period: 'asc' },
    });
    return { data };
  }

  async validateValue(id: string, dto: any, user: AuthenticatedUser) {
    const existing = await (this.prisma as any).pmIndicatorValue.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, `Indicator value ${id} not found`);

    const updated = await (this.prisma as any).pmIndicatorValue.update({
      where: { id },
      data: {
        verifiedValue: dto.verifiedValue,
        status: 'VALIDATED',
        validatedBy: user.userId,
        comment: dto.comment ?? existing.comment,
      },
    });

    return { data: updated };
  }

  /**
   * Progress summary for an indicator: baseline → target → latest actual
   */
  async progress(indicatorId: string) {
    const indicator = await (this.prisma as any).outputIndicator.findUnique({
      where: { id: indicatorId },
      include: { values: { orderBy: { period: 'desc' }, take: 1 } },
    });
    if (!indicator) throw new HttpError(404, `Indicator ${indicatorId} not found`);

    const latestValue = indicator.values[0];
    const actual = latestValue ? Number(latestValue.verifiedValue ?? latestValue.actualValue) : null;
    const target = Number(indicator.targetValue);
    const baseline = indicator.baselineValue ? Number(indicator.baselineValue) : 0;
    const progressPercent = target > baseline && actual !== null
      ? Math.round(((actual - baseline) / (target - baseline)) * 100)
      : 0;

    return {
      data: {
        indicatorId,
        code: indicator.code,
        name: indicator.name,
        unit: indicator.unit,
        baseline,
        target,
        actual,
        progressPercent,
        latestPeriod: latestValue?.period ?? null,
      },
    };
  }
}

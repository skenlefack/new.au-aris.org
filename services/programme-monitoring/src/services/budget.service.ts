import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import { DEFAULT_PAGE, DEFAULT_LIMIT, MAX_LIMIT } from '@aris/shared-types';
import type { KafkaHeaders } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { TOPIC_SYS_PROGRAMME_BUDGET_UPDATED } from '../kafka-topics.js';

const SERVICE_NAME = 'programme-monitoring-service';

export class HttpError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}

export class BudgetService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: StandaloneKafkaProducer,
  ) {}

  async create(dto: any, user: AuthenticatedUser) {
    const budget = await (this.prisma as any).activityBudget.create({
      data: {
        activityId: dto.activityId,
        budgetLineCode: dto.budgetLineCode,
        description: dto.description,
        fundingSource: dto.fundingSource,
        approvedAmount: dto.approvedAmount,
        committedAmount: dto.committedAmount ?? 0,
        disbursedAmount: dto.disbursedAmount ?? 0,
        executedAmount: dto.executedAmount ?? 0,
        currency: dto.currency ?? 'EUR',
        period: dto.period,
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });

    return { data: budget };
  }

  async findAll(
    _user: AuthenticatedUser,
    query: { page?: number; limit?: number; sort?: string; order?: string },
    filter: any,
  ) {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (filter.activityId) where['activityId'] = filter.activityId;
    if (filter.fundingSource) where['fundingSource'] = filter.fundingSource;
    if (filter.period) where['period'] = filter.period;

    // Filter by programmeId through activity → output → component → programme
    if (filter.programmeId) {
      where['activity'] = {
        output: { component: { programmeId: filter.programmeId } },
      };
    }

    const [data, total] = await Promise.all([
      (this.prisma as any).activityBudget.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { activity: { select: { id: true, code: true, name: true } } },
      }),
      (this.prisma as any).activityBudget.count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  async update(id: string, dto: any, user: AuthenticatedUser) {
    const existing = await (this.prisma as any).activityBudget.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, `Budget line ${id} not found`);

    const updateData: Record<string, unknown> = { updatedBy: user.userId };
    if (dto.budgetLineCode !== undefined) updateData['budgetLineCode'] = dto.budgetLineCode;
    if (dto.description !== undefined) updateData['description'] = dto.description;
    if (dto.fundingSource !== undefined) updateData['fundingSource'] = dto.fundingSource;
    if (dto.approvedAmount !== undefined) updateData['approvedAmount'] = dto.approvedAmount;
    if (dto.committedAmount !== undefined) updateData['committedAmount'] = dto.committedAmount;
    if (dto.disbursedAmount !== undefined) updateData['disbursedAmount'] = dto.disbursedAmount;
    if (dto.executedAmount !== undefined) updateData['executedAmount'] = dto.executedAmount;
    if (dto.currency !== undefined) updateData['currency'] = dto.currency;
    if (dto.period !== undefined) updateData['period'] = dto.period;

    const updated = await (this.prisma as any).activityBudget.update({ where: { id }, data: updateData });

    const headers: KafkaHeaders = {
      correlationId: randomUUID(),
      sourceService: SERVICE_NAME,
      tenantId: user.tenantId,
      userId: user.userId,
      schemaVersion: '1',
      timestamp: new Date().toISOString(),
    };
    try {
      await Promise.race([
        this.kafka.send(TOPIC_SYS_PROGRAMME_BUDGET_UPDATED, updated.id, updated, headers),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Kafka timeout')), 5000)),
      ]);
    } catch { /* non-critical */ }

    return { data: updated };
  }

  /**
   * Budget summary by output — matches the PDF dashboard "Execution By Output" table
   */
  async summaryByOutput(programmeId: string) {
    const outputs = await (this.prisma as any).programmeOutput.findMany({
      where: { component: { programmeId } },
      include: {
        activities: {
          include: {
            budgetLines: true,
          },
        },
      },
      orderBy: { code: 'asc' },
    });

    const summary = outputs.map((output: any) => {
      let approved = 0;
      let executed = 0;
      let committed = 0;
      let disbursed = 0;

      for (const act of output.activities) {
        for (const bl of act.budgetLines) {
          approved += Number(bl.approvedAmount);
          executed += Number(bl.executedAmount);
          committed += Number(bl.committedAmount);
          disbursed += Number(bl.disbursedAmount);
        }
      }

      const balance = approved - executed;
      const percentExec = approved > 0 ? Math.round((executed / approved) * 100) : 0;

      return {
        outputId: output.id,
        outputCode: output.code,
        outputName: output.name,
        approvedBudget: Number(output.approvedBudget),
        approved,
        executed,
        committed,
        disbursed,
        balance,
        percentExec,
        activityCount: output.activities.length,
      };
    });

    const totals = summary.reduce(
      (acc: any, s: any) => ({
        approved: acc.approved + s.approved,
        executed: acc.executed + s.executed,
        committed: acc.committed + s.committed,
        disbursed: acc.disbursed + s.disbursed,
        balance: acc.balance + s.balance,
      }),
      { approved: 0, executed: 0, committed: 0, disbursed: 0, balance: 0 },
    );
    totals.percentExec = totals.approved > 0 ? Math.round((totals.executed / totals.approved) * 100) : 0;

    return { data: { outputs: summary, totals } };
  }
}

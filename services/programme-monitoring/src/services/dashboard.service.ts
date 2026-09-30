import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';

export class HttpError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}

export class DashboardService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly _kafka: StandaloneKafkaProducer,
  ) {}

  /**
   * Main execution dashboard — reproduces the PDF from the Directrice
   * KPIs: Approved, Executed, Balance, % Exec
   * Execution by Output (bar chart data)
   * Status mix (donut chart data)
   */
  async executionDashboard(programmeId: string) {
    const programme = await (this.prisma as any).programme.findUnique({
      where: { id: programmeId },
      include: {
        components: {
          orderBy: { sortOrder: 'asc' },
          include: {
            outputs: {
              orderBy: { sortOrder: 'asc' },
              include: {
                activities: {
                  include: { budgetLines: true },
                },
              },
            },
          },
        },
      },
    });

    if (!programme) throw new HttpError(404, `Programme ${programmeId} not found`);

    // ── Execution by Output ──
    const executionByOutput = [];
    let totalApproved = 0;
    let totalExecuted = 0;
    let totalCommitted = 0;

    for (const comp of programme.components) {
      for (const output of comp.outputs) {
        let approved = 0;
        let executed = 0;
        let committed = 0;

        for (const act of output.activities) {
          for (const bl of act.budgetLines) {
            approved += Number(bl.approvedAmount);
            executed += Number(bl.executedAmount);
            committed += Number(bl.committedAmount);
          }
        }

        totalApproved += approved;
        totalExecuted += executed;
        totalCommitted += committed;

        executionByOutput.push({
          outputCode: output.code,
          outputName: output.name,
          approved,
          executed,
          balance: approved - executed,
          percentExec: approved > 0 ? Math.round((executed / approved) * 100) : 0,
        });
      }
    }

    // ── Status Mix ──
    const activities = programme.components.flatMap((c: any) =>
      c.outputs.flatMap((o: any) => o.activities),
    );

    const statusCounts: Record<string, number> = {
      NOT_STARTED: 0,
      PLANNED: 0,
      IN_PROGRESS: 0,
      COMPLETED: 0,
      DELAYED: 0,
      CANCELLED: 0,
      ON_HOLD: 0,
    };

    const ragCounts = { GREEN: 0, AMBER: 0, RED: 0, GREY: 0 };

    for (const act of activities) {
      statusCounts[act.status] = (statusCounts[act.status] || 0) + 1;
      const rag = act.ragStatus as keyof typeof ragCounts;
      if (rag in ragCounts) ragCounts[rag]++;
    }

    const totalActivities = activities.length;
    const avgCompletion = totalActivities > 0
      ? Math.round(activities.reduce((s: number, a: any) => s + a.completionPercent, 0) / totalActivities)
      : 0;

    return {
      data: {
        programme: {
          id: programme.id,
          code: programme.code,
          name: programme.name,
          currency: programme.currency,
          totalBudget: Number(programme.totalBudget),
          status: programme.status,
          startDate: programme.startDate,
          endDate: programme.endDate,
        },
        kpis: {
          totalApproved,
          totalExecuted,
          totalCommitted,
          totalBalance: totalApproved - totalExecuted,
          executionRate: totalApproved > 0 ? Math.round((totalExecuted / totalApproved) * 100) : 0,
          totalActivities,
          avgCompletion,
        },
        executionByOutput,
        statusMix: {
          counts: statusCounts,
          total: totalActivities,
          percentages: Object.fromEntries(
            Object.entries(statusCounts).map(([k, v]) => [
              k,
              totalActivities > 0 ? Math.round((v / totalActivities) * 1000) / 10 : 0,
            ]),
          ),
        },
        ragSummary: ragCounts,
      },
    };
  }

  /**
   * Regional breakdown — per geoEntity for activities assigned to specific regions
   */
  async regionalBreakdown(programmeId: string) {
    const activities = await (this.prisma as any).activity.findMany({
      where: {
        output: { component: { programmeId } },
        geoEntityId: { not: null },
      },
      include: {
        budgetLines: true,
      },
    });

    const byRegion: Record<string, {
      geoEntityId: string;
      total: number;
      completed: number;
      inProgress: number;
      delayed: number;
      notStarted: number;
      approved: number;
      executed: number;
      avgCompletion: number;
    }> = {};

    for (const act of activities) {
      const geo = act.geoEntityId as string;
      if (!byRegion[geo]) {
        byRegion[geo] = {
          geoEntityId: geo,
          total: 0, completed: 0, inProgress: 0, delayed: 0, notStarted: 0,
          approved: 0, executed: 0, avgCompletion: 0,
        };
      }

      const region = byRegion[geo];
      region.total++;
      if (act.status === 'COMPLETED') region.completed++;
      else if (act.status === 'IN_PROGRESS') region.inProgress++;
      else if (act.status === 'DELAYED') region.delayed++;
      else if (act.status === 'NOT_STARTED') region.notStarted++;

      for (const bl of act.budgetLines) {
        region.approved += Number(bl.approvedAmount);
        region.executed += Number(bl.executedAmount);
      }

      region.avgCompletion += act.completionPercent;
    }

    // Calculate averages
    const regions = Object.values(byRegion).map(r => ({
      ...r,
      avgCompletion: r.total > 0 ? Math.round(r.avgCompletion / r.total) : 0,
      executionRate: r.approved > 0 ? Math.round((r.executed / r.approved) * 100) : 0,
    }));

    return { data: regions };
  }

  /**
   * Timeline / Gantt data — activities with dates for Gantt chart rendering
   */
  async timelineGantt(programmeId: string) {
    const activities = await (this.prisma as any).activity.findMany({
      where: { output: { component: { programmeId } } },
      select: {
        id: true,
        code: true,
        name: true,
        status: true,
        ragStatus: true,
        plannedStartDate: true,
        plannedEndDate: true,
        actualStartDate: true,
        actualEndDate: true,
        completionPercent: true,
        responsibleUnit: true,
        output: {
          select: {
            code: true,
            name: true,
            component: { select: { code: true, name: true } },
          },
        },
        milestones: {
          select: { id: true, name: true, dueDate: true, status: true, completedAt: true },
          orderBy: { dueDate: 'asc' },
        },
      },
      orderBy: { code: 'asc' },
    });

    return { data: activities };
  }

  /**
   * Burn rate chart — cumulative executed vs planned over time
   */
  async burnRate(programmeId: string) {
    const snapshots = await (this.prisma as any).programmeSnapshot.findMany({
      where: { programmeId },
      orderBy: { snapshotDate: 'asc' },
      select: {
        snapshotDate: true,
        totalApproved: true,
        totalExecuted: true,
        executionRate: true,
        completed: true,
        totalActivities: true,
      },
    });

    return { data: snapshots };
  }

  /**
   * Create a weekly snapshot of the programme state
   */
  async createSnapshot(programmeId: string) {
    const activities = await (this.prisma as any).activity.findMany({
      where: { output: { component: { programmeId } } },
      include: { budgetLines: true },
    });

    const counts = {
      total: activities.length,
      notStarted: 0, inProgress: 0, completed: 0, delayed: 0, onHold: 0, cancelled: 0,
      green: 0, amber: 0, red: 0, grey: 0,
    };
    let totalCompletion = 0;
    let totalApproved = 0;
    let totalExecuted = 0;

    for (const act of activities) {
      if (act.status === 'NOT_STARTED' || act.status === 'PLANNED') counts.notStarted++;
      else if (act.status === 'IN_PROGRESS') counts.inProgress++;
      else if (act.status === 'COMPLETED') counts.completed++;
      else if (act.status === 'DELAYED') counts.delayed++;
      else if (act.status === 'ON_HOLD') counts.onHold++;
      else if (act.status === 'CANCELLED') counts.cancelled++;

      if (act.ragStatus === 'GREEN') counts.green++;
      else if (act.ragStatus === 'AMBER') counts.amber++;
      else if (act.ragStatus === 'RED') counts.red++;
      else counts.grey++;

      totalCompletion += act.completionPercent;
      for (const bl of act.budgetLines) {
        totalApproved += Number(bl.approvedAmount);
        totalExecuted += Number(bl.executedAmount);
      }
    }

    const snapshot = await (this.prisma as any).programmeSnapshot.create({
      data: {
        programmeId,
        snapshotDate: new Date(),
        totalActivities: counts.total,
        notStarted: counts.notStarted,
        inProgress: counts.inProgress,
        completed: counts.completed,
        delayed: counts.delayed,
        onHold: counts.onHold,
        cancelled: counts.cancelled,
        avgCompletion: counts.total > 0 ? totalCompletion / counts.total : 0,
        totalApproved,
        totalExecuted,
        executionRate: totalApproved > 0 ? (totalExecuted / totalApproved) * 100 : 0,
        greenCount: counts.green,
        amberCount: counts.amber,
        redCount: counts.red,
        greyCount: counts.grey,
      },
    });

    return { data: snapshot };
  }
}

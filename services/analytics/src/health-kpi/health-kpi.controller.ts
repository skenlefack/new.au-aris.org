import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { ApiResponse } from '@aris/shared-types';
import { HealthKpiService } from './health-kpi.service';
import type {
  HealthKpis,
  HealthTrends,
  QualityDashboard,
  WorkflowTimeliness,
  DenominatorEntry,
} from './dto/health-kpis.dto';

@Controller('analytics')
export class HealthKpiController {
  constructor(private readonly healthKpiService: HealthKpiService) {}

  @Get('health/kpis')
  async getHealthKpis(
    @Query('country') country?: string,
    @Query('disease') disease?: string,
  ): Promise<ApiResponse<HealthKpis>> {
    const data = await this.healthKpiService.getHealthKpis(country, disease);
    return { data };
  }

  @Get('health/trends')
  async getHealthTrends(
    @Query('period') period?: string,
  ): Promise<ApiResponse<HealthTrends>> {
    const months = period ? parseInt(period.replace('m', ''), 10) : 6;
    const data = await this.healthKpiService.getHealthTrends(
      isNaN(months) ? 6 : months,
    );
    return { data };
  }

  @Get('quality/dashboard')
  async getQualityDashboard(): Promise<ApiResponse<QualityDashboard>> {
    const data = await this.healthKpiService.getQualityDashboard();
    return { data };
  }

  @Get('workflow/timeliness')
  async getWorkflowTimeliness(): Promise<ApiResponse<WorkflowTimeliness>> {
    const data = await this.healthKpiService.getWorkflowTimeliness();
    return { data };
  }

  @Get('denominators')
  async getDenominators(
    @Query('country') country?: string,
  ): Promise<ApiResponse<DenominatorEntry[]>> {
    const data = await this.healthKpiService.getDenominators(country);
    return { data };
  }

  @Get('export/csv')
  async exportCsv(
    @Query('domain') domain: string,
    @Query('country') country?: string,
    @Res() res?: Response,
  ): Promise<void> {
    const csvDomain = domain ?? 'health';
    let rows: string[][] = [];
    let headers: string[] = [];

    if (csvDomain === 'health') {
      headers = ['countryCode', 'diseaseId', 'active', 'confirmed', 'cases', 'deaths'];
      const kpis = await this.healthKpiService.getHealthKpisByDisease(country);
      rows = kpis.map((k) => [
        k.countryCode,
        k.diseaseId,
        String(k.active),
        String(k.confirmed),
        String(k.cases),
        String(k.deaths),
      ]);
    } else if (csvDomain === 'vaccination') {
      headers = ['countryCode', 'diseaseId', 'dosesUsed', 'targetPopulation', 'coverage', 'campaigns'];
      const denoms = await this.healthKpiService.getDenominators(country);
      rows = denoms.map((d) => [
        d.countryCode,
        d.diseaseId,
        String(d.dosesUsed),
        String(d.targetPopulation),
        String(d.coverage),
        String(d.campaigns),
      ]);
    } else if (csvDomain === 'quality') {
      headers = ['passRate', 'failRate', 'totalRecords', 'passCount', 'failCount'];
      const q = await this.healthKpiService.getQualityDashboard();
      rows = [[
        String(q.passRate),
        String(q.failRate),
        String(q.totalRecords),
        String(q.passCount),
        String(q.failCount),
      ]];
    }

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    if (res) {
      res.set({
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="analytics-${csvDomain}.csv"`,
      });
      res.send(csv);
    }
  }
}

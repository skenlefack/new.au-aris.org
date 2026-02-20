import { Controller, Get } from '@nestjs/common';
import type { ApiResponse } from '@aris/shared-types';
import { HealthKpiService } from './health-kpi.service';
import type { HealthKpis } from './dto/health-kpis.dto';

@Controller('analytics/health')
export class HealthKpiController {
  constructor(private readonly healthKpiService: HealthKpiService) {}

  @Get('kpis')
  async getKpis(): Promise<ApiResponse<HealthKpis>> {
    const data = await this.healthKpiService.getKpis();
    return { data };
  }
}

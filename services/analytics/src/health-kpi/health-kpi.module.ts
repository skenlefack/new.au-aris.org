import { Module } from '@nestjs/common';
import { RedisService } from '../redis.service';
import { HealthKpiController } from './health-kpi.controller';
import { HealthKpiService } from './health-kpi.service';

@Module({
  controllers: [HealthKpiController],
  providers: [RedisService, HealthKpiService],
  exports: [HealthKpiService],
})
export class HealthKpiModule {}

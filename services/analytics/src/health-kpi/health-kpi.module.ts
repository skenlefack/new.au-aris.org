import { Module } from '@nestjs/common';
import { RedisService } from '../redis.service';
import { HealthKpiController } from './health-kpi.controller';
import { HealthKpiService } from './health-kpi.service';
import { HealthEventConsumer } from './health-event.consumer';

@Module({
  controllers: [HealthKpiController],
  providers: [RedisService, HealthKpiService, HealthEventConsumer],
  exports: [HealthKpiService],
})
export class HealthKpiModule {}

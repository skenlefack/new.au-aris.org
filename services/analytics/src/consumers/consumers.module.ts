import { Module } from '@nestjs/common';
import { AggregationModule } from '../aggregation/aggregation.module';
import { HealthEventConsumer } from './health-event.consumer';
import { VaccinationConsumer } from './vaccination.consumer';
import { LabResultConsumer } from './lab-result.consumer';
import { QualityConsumer } from './quality.consumer';
import { WorkflowConsumer } from './workflow.consumer';

@Module({
  imports: [AggregationModule],
  providers: [
    HealthEventConsumer,
    VaccinationConsumer,
    LabResultConsumer,
    QualityConsumer,
    WorkflowConsumer,
  ],
})
export class ConsumersModule {}

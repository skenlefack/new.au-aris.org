import { Module } from '@nestjs/common';
import { AggregationModule } from '../aggregation/aggregation.module';
import { DomainAggregationModule } from '../domain-aggregation/domain-aggregation.module';
import { HealthEventConsumer } from './health-event.consumer';
import { VaccinationConsumer } from './vaccination.consumer';
import { LabResultConsumer } from './lab-result.consumer';
import { QualityConsumer } from './quality.consumer';
import { WorkflowConsumer } from './workflow.consumer';
import { LivestockConsumer } from './livestock.consumer';
import { FisheriesConsumer } from './fisheries.consumer';
import { WildlifeConsumer } from './wildlife.consumer';
import { TradeConsumer } from './trade.consumer';
import { ClimateConsumer } from './climate.consumer';
import { ApicultureConsumer } from './apiculture.consumer';
import { GovernanceConsumer } from './governance.consumer';

@Module({
  imports: [AggregationModule, DomainAggregationModule],
  providers: [
    // Existing health/quality/workflow consumers
    HealthEventConsumer,
    VaccinationConsumer,
    LabResultConsumer,
    QualityConsumer,
    WorkflowConsumer,
    // Cross-domain consumers
    LivestockConsumer,
    FisheriesConsumer,
    WildlifeConsumer,
    TradeConsumer,
    ClimateConsumer,
    ApicultureConsumer,
    GovernanceConsumer,
  ],
})
export class ConsumersModule {}

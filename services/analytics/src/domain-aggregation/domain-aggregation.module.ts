import { Module } from '@nestjs/common';
import { RedisService } from '../redis.service';
import { DomainAggregationService } from './domain-aggregation.service';

@Module({
  providers: [RedisService, DomainAggregationService],
  exports: [DomainAggregationService],
})
export class DomainAggregationModule {}

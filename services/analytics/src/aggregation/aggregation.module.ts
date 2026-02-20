import { Module } from '@nestjs/common';
import { RedisService } from '../redis.service';
import { AggregationService } from './aggregation.service';

@Module({
  providers: [RedisService, AggregationService],
  exports: [AggregationService],
})
export class AggregationModule {}

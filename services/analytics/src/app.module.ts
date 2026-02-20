import { Module } from '@nestjs/common';
import { KafkaModule } from '@aris/kafka-client';
import { AuthModule } from '@aris/auth-middleware';
import { RedisService } from './redis.service';
import { HealthKpiModule } from './health-kpi/health-kpi.module';
import { HealthModule } from './health/health.module';
import { AggregationModule } from './aggregation/aggregation.module';
import { ConsumersModule } from './consumers/consumers.module';

@Module({
  imports: [
    KafkaModule.forRoot({
      clientId: process.env['KAFKA_CLIENT_ID'] ?? 'aris-analytics-service',
      brokers: (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(','),
    }),
    AuthModule.forRoot({
      publicKey: process.env['JWT_PUBLIC_KEY'] ?? '',
    }),
    AggregationModule,
    ConsumersModule,
    HealthKpiModule,
    HealthModule,
  ],
  providers: [RedisService],
  exports: [RedisService],
})
export class AppModule {}

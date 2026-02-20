import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { KafkaModule } from '@aris/kafka-client';
import { AuthModule } from '@aris/auth-middleware';
import { PrismaService } from './prisma.service';
import { ValidateModule } from './validate/validate.module';
import { ReportModule } from './report/report.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { RuleModule } from './rule/rule.module';
import { CorrectionModule } from './correction/correction.module';
import { EngineModule } from './engine/engine.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    KafkaModule.forRoot({
      clientId: process.env['KAFKA_CLIENT_ID'] ?? 'aris-data-quality-service',
      brokers: (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(','),
    }),
    AuthModule.forRoot({
      publicKey: process.env['JWT_PUBLIC_KEY'] ?? '',
    }),
    EngineModule,
    ValidateModule,
    ReportModule,
    DashboardModule,
    RuleModule,
    CorrectionModule,
  ],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule {}

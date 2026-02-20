import { Module } from '@nestjs/common';
import { KafkaModule } from '@aris/kafka-client';
import { AuthModule } from '@aris/auth-middleware';
import { PrismaService } from './prisma.service';
import { AuditService } from './audit.service';
import { LegalFrameworkModule } from './legal-framework/legal-framework.module';
import { CapacityModule } from './capacity/capacity.module';
import { PvsEvaluationModule } from './pvs-evaluation/pvs-evaluation.module';
import { StakeholderModule } from './stakeholder/stakeholder.module';

@Module({
  imports: [
    KafkaModule.forRoot({
      clientId: process.env['KAFKA_CLIENT_ID'] ?? 'aris-governance-service',
      brokers: (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(','),
    }),
    AuthModule.forRoot({
      publicKey: process.env['JWT_PUBLIC_KEY'] ?? '',
    }),
    LegalFrameworkModule,
    CapacityModule,
    PvsEvaluationModule,
    StakeholderModule,
  ],
  providers: [PrismaService, AuditService],
  exports: [PrismaService, AuditService],
})
export class AppModule {}

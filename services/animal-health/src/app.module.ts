import { Module } from '@nestjs/common';
import { KafkaModule } from '@aris/kafka-client';
import { AuthModule } from '@aris/auth-middleware';
import { PrismaService } from './prisma.service';
import { AuditService } from './audit.service';
import { HealthEventModule } from './health-event/health-event.module';
import { LabResultModule } from './lab-result/lab-result.module';
import { SurveillanceModule } from './surveillance/surveillance.module';
import { VaccinationModule } from './vaccination/vaccination.module';
import { CapacityModule } from './capacity/capacity.module';

@Module({
  imports: [
    KafkaModule.forRoot({
      clientId: process.env['KAFKA_CLIENT_ID'] ?? 'aris-animal-health-service',
      brokers: (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(','),
    }),
    AuthModule.forRoot({
      publicKey: process.env['JWT_PUBLIC_KEY'] ?? '',
    }),
    HealthEventModule,
    LabResultModule,
    SurveillanceModule,
    VaccinationModule,
    CapacityModule,
  ],
  providers: [PrismaService, AuditService],
  exports: [PrismaService, AuditService],
})
export class AppModule {}

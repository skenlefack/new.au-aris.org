import { Module } from '@nestjs/common';
import { KafkaModule } from '@aris/kafka-client';
import { AuthModule } from '@aris/auth-middleware';
import { PrismaService } from './prisma.service';
import { AuditService } from './audit.service';
import { ApiaryModule } from './apiary/apiary.module';
import { ProductionModule } from './production/production.module';
import { ColonyHealthModule } from './colony-health/colony-health.module';
import { TrainingModule } from './training/training.module';

@Module({
  imports: [
    KafkaModule.forRoot({
      clientId: process.env['KAFKA_CLIENT_ID'] ?? 'aris-apiculture-service',
      brokers: (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(','),
    }),
    AuthModule.forRoot({
      publicKey: process.env['JWT_PUBLIC_KEY'] ?? '',
    }),
    ApiaryModule,
    ProductionModule,
    ColonyHealthModule,
    TrainingModule,
  ],
  providers: [PrismaService, AuditService],
  exports: [PrismaService, AuditService],
})
export class AppModule {}

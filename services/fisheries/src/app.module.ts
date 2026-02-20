import { Module } from '@nestjs/common';
import { KafkaModule } from '@aris/kafka-client';
import { AuthModule } from '@aris/auth-middleware';
import { PrismaService } from './prisma.service';
import { AuditService } from './audit.service';
import { CaptureModule } from './capture/capture.module';
import { VesselModule } from './vessel/vessel.module';
import { AquacultureFarmModule } from './aquaculture-farm/aquaculture-farm.module';
import { AquacultureProductionModule } from './aquaculture-production/aquaculture-production.module';

@Module({
  imports: [
    KafkaModule.forRoot({
      clientId: process.env['KAFKA_CLIENT_ID'] ?? 'aris-fisheries-service',
      brokers: (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(','),
    }),
    AuthModule.forRoot({
      publicKey: process.env['JWT_PUBLIC_KEY'] ?? '',
    }),
    CaptureModule,
    VesselModule,
    AquacultureFarmModule,
    AquacultureProductionModule,
  ],
  providers: [PrismaService, AuditService],
  exports: [PrismaService, AuditService],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { KafkaModule } from '@aris/kafka-client';
import { AuthModule } from '@aris/auth-middleware';
import { PrismaService } from './prisma.service';
import { AuditService } from './audit.service';
import { WaterStressModule } from './water-stress/water-stress.module';
import { RangelandModule } from './rangeland/rangeland.module';
import { HotspotModule } from './hotspot/hotspot.module';
import { ClimateDataModule } from './climate-data/climate-data.module';

@Module({
  imports: [
    KafkaModule.forRoot({
      clientId: process.env['KAFKA_CLIENT_ID'] ?? 'aris-climate-env-service',
      brokers: (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(','),
    }),
    AuthModule.forRoot({
      publicKey: process.env['JWT_PUBLIC_KEY'] ?? '',
    }),
    WaterStressModule,
    RangelandModule,
    HotspotModule,
    ClimateDataModule,
  ],
  providers: [PrismaService, AuditService],
  exports: [PrismaService, AuditService],
})
export class AppModule {}
